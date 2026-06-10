-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hikes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "activity_type" TEXT,
    "difficulty_raw" TEXT,
    "max_elevation_m" INTEGER,
    "ascent_m" INTEGER,
    "descent_m" INTEGER,
    "distance_km" DECIMAL(6,2),
    "is_multi_day" BOOLEAN NOT NULL DEFAULT false,
    "is_loop" BOOLEAN NOT NULL DEFAULT false,
    "start_location" TEXT,
    "end_location" TEXT,
    "destination_type" TEXT,
    "uses_cable_car" BOOLEAN NOT NULL DEFAULT false,
    "season" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "completed_date" DATE,
    "notes" TEXT,
    "source" TEXT NOT NULL,
    "import_hash" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hike_links" (
    "id" UUID NOT NULL,
    "hike_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hike_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hike_gpx_files" (
    "id" UUID NOT NULL,
    "hike_id" UUID NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT,
    "storage_path" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "geojson" JSONB,
    "route_bounds" JSONB,
    "route_center" JSONB,
    "route_distance_m" DECIMAL(10,2),
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hike_gpx_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "hike_gpx_files_hike_id_key" ON "hike_gpx_files"("hike_id");

-- AddForeignKey
ALTER TABLE "hikes" ADD CONSTRAINT "hikes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hike_links" ADD CONSTRAINT "hike_links_hike_id_fkey" FOREIGN KEY ("hike_id") REFERENCES "hikes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hike_gpx_files" ADD CONSTRAINT "hike_gpx_files_hike_id_fkey" FOREIGN KEY ("hike_id") REFERENCES "hikes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
