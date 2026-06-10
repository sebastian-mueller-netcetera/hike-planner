import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

// Simple djb2-style hash — no crypto module
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseGermanBool(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "ja";
  }
  return false;
}

function parseInteger(
  value: unknown,
  fieldName: string,
  warnings: string[],
  rowNum: number
): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const n = Math.round(value);
    return isNaN(n) ? null : n;
  }
  // Strip everything except digits and leading minus
  const str = String(value).replace(/[^\d-]/g, "");
  if (!str || str === "-") {
    warnings.push(
      `Zeile ${rowNum}: Ungültiger Ganzzahlwert für "${fieldName}": "${value}"`
    );
    return null;
  }
  const num = parseInt(str, 10);
  if (isNaN(num)) {
    warnings.push(
      `Zeile ${rowNum}: Ungültiger Ganzzahlwert für "${fieldName}": "${value}"`
    );
    return null;
  }
  return num;
}

function parseDecimal(
  value: unknown,
  fieldName: string,
  warnings: string[],
  rowNum: number
): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return isNaN(value) ? null : Math.round(value * 100) / 100;
  }
  // Handle German comma decimal separator, strip everything except digits / period / minus
  const str = String(value).replace(",", ".").replace(/[^\d.-]/g, "");
  if (!str) {
    warnings.push(
      `Zeile ${rowNum}: Ungültiger Dezimalwert für "${fieldName}": "${value}"`
    );
    return null;
  }
  const num = parseFloat(str);
  if (isNaN(num)) {
    warnings.push(
      `Zeile ${rowNum}: Ungültiger Dezimalwert für "${fieldName}": "${value}"`
    );
    return null;
  }
  return Math.round(num * 100) / 100;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || !file.name.endsWith(".xlsx")) {
    return NextResponse.json(
      { error: "Eine gültige .xlsx-Datei wird benötigt" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "Die Arbeitsmappe enthält kein Tabellenblatt" },
        { status: 400 }
      );
    }
    const sheet = workbook.Sheets[sheetName];

    // raw:true keeps numeric cells as numbers; defval:"" fills empty cells
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: true,
      blankrows: false,
    });

    const warnings: string[] = [];
    const preview: unknown[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // row 1 = header, data starts at row 2

      const name = String(row["Titel"] ?? "").trim();
      if (!name) {
        warnings.push(
          `Zeile ${rowNum}: Leerer Titel — Zeile wird übersprungen`
        );
        continue;
      }

      const region = String(row["Region"] ?? "").trim() || null;
      const activityType = String(row["Sportart"] ?? "").trim() || null;
      const difficultyRaw = String(row["Schwierigkeit"] ?? "").trim() || null;
      const startLocation = String(row["Start"] ?? "").trim() || null;
      const endLocation = String(row["Ziel"] ?? "").trim() || null;
      const destinationType = String(row["Zielart"] ?? "").trim() || null;
      const season = String(row["Saison"] ?? "").trim() || null;

      const maxElevationM = parseInteger(
        row["Max Höhe"],
        "Max Höhe",
        warnings,
        rowNum
      );
      const ascentM = parseInteger(
        row["Aufstieg"],
        "Aufstieg",
        warnings,
        rowNum
      );
      const descentM = parseInteger(
        row["Abstieg"],
        "Abstieg",
        warnings,
        rowNum
      );
      const distanceKm = parseDecimal(
        row["Distanz"],
        "Distanz",
        warnings,
        rowNum
      );

      const isMultiDay = parseGermanBool(row["Mehrtagestour"]);
      const isLoop = parseGermanBool(row["Rundtour"]);
      const usesCableCar = parseGermanBool(row["Seilbahn?"]);

      // Collect Link 1–5, drop empty values
      const links: string[] = [];
      for (let l = 1; l <= 5; l++) {
        const link = String(row[`Link ${l}`] ?? "").trim();
        if (link) links.push(link);
      }

      // importHash: stable fingerprint for deduplication
      const hashInput = [
        name,
        region ?? "",
        startLocation ?? "",
        endLocation ?? "",
        activityType ?? "",
      ].join("|");
      const importHash = simpleHash(hashInput);

      preview.push({
        name,
        region,
        activityType,
        difficultyRaw,
        maxElevationM,
        ascentM,
        descentM,
        distanceKm,
        isMultiDay,
        isLoop,
        startLocation,
        endLocation,
        destinationType,
        usesCableCar,
        season,
        links,
        importHash,
      });
    }

    return NextResponse.json({
      rowCount: preview.length,
      preview,
      warnings,
    });
  } catch (err) {
    console.error("Excel preview error:", err);
    return NextResponse.json(
      { error: "Fehler beim Verarbeiten der Excel-Datei" },
      { status: 500 }
    );
  }
}
