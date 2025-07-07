-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "profile_visibility" TEXT NOT NULL DEFAULT 'public',
    "phone_visibility" TEXT NOT NULL DEFAULT 'friends',
    "email_visibility" TEXT NOT NULL DEFAULT 'private',
    "last_seen_visibility" TEXT NOT NULL DEFAULT 'everyone',
    "allow_search_by_phone" BOOLEAN NOT NULL DEFAULT true,
    "allow_search_by_email" BOOLEAN NOT NULL DEFAULT false,
    "message_notifications" BOOLEAN NOT NULL DEFAULT true,
    "group_notifications" BOOLEAN NOT NULL DEFAULT true,
    "friend_request_notifications" BOOLEAN NOT NULL DEFAULT true,
    "email_notifications" BOOLEAN NOT NULL DEFAULT false,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "vibration_enabled" BOOLEAN NOT NULL DEFAULT true,
    "read_receipts" BOOLEAN NOT NULL DEFAULT true,
    "typing_indicators" BOOLEAN NOT NULL DEFAULT true,
    "auto_download_images" BOOLEAN NOT NULL DEFAULT true,
    "auto_download_videos" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
