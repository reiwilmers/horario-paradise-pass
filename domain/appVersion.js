export function isRemoteVersionNewer(localVersion, remoteVersion) {
  const local = Number(localVersion);
  const remote = Number(remoteVersion);
  if (!Number.isFinite(local) || !Number.isFinite(remote)) return false;
  return remote > local;
}

export function appUpdateMessage() {
  return 'Hay una versión nueva, borra esta versión y agrega la nueva';
}
