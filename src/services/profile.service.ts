import type { UpdateProfileInput } from "@interpret-hub/shared";
import { prisma } from "../lib/prisma.js";
import { PROFILE_PHOTO_PUBLIC_PREFIX, unlinkIfUploadedPhoto } from "../lib/profile-photo-storage.js";

export async function getFullProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { interpreterProfile: true },
  });
  return user;
}

export async function updateMyProfile(userId: number, data: UpdateProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.emergencyContact !== undefined ? { emergencyContact: data.emergencyContact } : {}),
      ...(data.languages !== undefined ? { languages: data.languages } : {}),
    },
    include: { interpreterProfile: true },
  });
}

/** Store path like `/uploads/profile-photos/{file}`; removes previous uploaded file if any. */
export async function setUploadedProfilePhoto(userId: number, filename: string) {
  const publicPath = `${PROFILE_PHOTO_PUBLIC_PREFIX}/${filename}`;
  const prev = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePhoto: true },
  });
  const user = await prisma.user.update({
    where: { id: userId },
    data: { profilePhoto: publicPath },
    include: { interpreterProfile: true },
  });
  if (prev?.profilePhoto && prev.profilePhoto !== publicPath) {
    unlinkIfUploadedPhoto(prev.profilePhoto);
  }
  return user;
}

export async function clearProfilePhoto(userId: number) {
  const prev = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePhoto: true },
  });
  const user = await prisma.user.update({
    where: { id: userId },
    data: { profilePhoto: null },
    include: { interpreterProfile: true },
  });
  unlinkIfUploadedPhoto(prev?.profilePhoto);
  return user;
}
