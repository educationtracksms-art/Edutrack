import { supabase } from "@/integrations/supabase/client";

export const IMAGE_BUCKET = "images";
export const MAX_IMAGE_SIZE_BYTES = 1 * 1024 * 1024;

export function validateImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image size must be 1 MB or less.");
  }
}

export async function uploadImage(file: File, pathPrefix: string) {
  validateImageFile(file);

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safePrefix = pathPrefix.replace(/[^a-zA-Z0-9/_-]/g, "_");
  const filePath = `${safePrefix}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}
