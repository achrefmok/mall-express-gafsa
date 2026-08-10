"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Téléversement d'image vers Supabase Storage.
 *
 * Le chemin commence par l'identifiant du propriétaire : les policies de
 * storage.objects s'appuient sur ce premier segment pour autoriser l'écriture.
 * Les photos sont réduites côté navigateur avant l'envoi — un cliché de
 * téléphone pèse plusieurs mégaoctets, ce qui est inutile pour une vignette
 * et coûteux sur un réseau mobile.
 */

const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<Blob> {
  // Les formats vectoriels ou déjà légers passent tels quels.
  if (!file.type.startsWith("image/") || file.size < 200 * 1024) return file;

  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );

  // Si la conversion n'a rien gagné, garder l'original.
  return blob && blob.size < file.size ? blob : file;
}

export interface UploadResult {
  path: string;
  publicUrl: string;
}

export async function uploadImage(
  bucket: "avatars" | "shop-assets" | "products" | "deals" | "live-covers",
  file: File,
): Promise<UploadResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentification requise");

  const body = await compressImage(file);
  const extension = body.type === "image/webp" ? "webp" : (file.name.split(".").pop() ?? "jpg");
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: body.type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return { path, publicUrl };
}

export async function deleteImage(
  bucket: "avatars" | "shop-assets" | "products" | "deals" | "live-covers",
  publicUrl: string,
): Promise<void> {
  const supabase = createClient();

  // Reconstituer le chemin de stockage depuis l'URL publique.
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;

  const path = decodeURIComponent(publicUrl.slice(index + marker.length));
  await supabase.storage.from(bucket).remove([path]);
}
