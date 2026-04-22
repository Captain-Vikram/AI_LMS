#!/usr/bin/env python3
"""Create backups for MongoDB and SurrealDB data.

- Archives the host `mongo-data` directory into `backups/mongo-data-<ts>.tar.gz`.
- Attempts to copy `/data/quasar-vector.db` from the `quasar-vector-db` container
  into `backups/quasar-vector-db-<ts>.db`. If `docker cp` fails, it tries to
  inspect the `surrealdb_data` Docker volume mountpoint and copy the file from there.

Files are placed in the repository `backups/` directory.
"""

from __future__ import annotations

import os
import sys
import tarfile
import shutil
import subprocess
from datetime import datetime


def now_ts() -> str:
    return datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")


def human_size(path: str) -> str:
    try:
        size = os.path.getsize(path)
        for unit in ("B", "KB", "MB", "GB"):
            if size < 1024.0:
                return f"{size:3.1f}{unit}"
            size /= 1024.0
        return f"{size:.1f}TB"
    except Exception:
        return "-"


def archive_mongo(mongo_dir: str, backup_dir: str, ts: str) -> str | None:
    if not os.path.isdir(mongo_dir):
        print(f"mongo-data directory not found: {mongo_dir}")
        return None

    out_name = f"mongo-data-{ts}.tar.gz"
    out_path = os.path.join(backup_dir, out_name)

    with tarfile.open(out_path, "w:gz") as tar:
        # add the directory itself as 'mongo-data' in the archive
        tar.add(mongo_dir, arcname=os.path.basename(mongo_dir))

    return out_path


def copy_surreal_from_container(container: str, container_path: str, dest_path: str) -> bool:
    try:
        subprocess.run(["docker", "cp", f"{container}:{container_path}", dest_path], check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"docker cp failed: {e}")
        return False


def copy_surreal_from_volume(volume_name: str, dest_path: str) -> bool:
    try:
        out = subprocess.check_output(["docker", "volume", "inspect", volume_name, "--format", "{{.Mountpoint}}"])
        mountpoint = out.decode().strip()
        if not mountpoint or not os.path.isdir(mountpoint):
            print("Volume mountpoint not found or inaccessible:", mountpoint)
            return False

        src = os.path.join(mountpoint, "quasar-vector.db")
        if not os.path.exists(src):
            print("SurrealDB data file not found at volume mountpoint:", src)
            return False

        shutil.copy2(src, dest_path)
        return True
    except Exception as e:
        print("Failed to inspect or copy from volume:", e)
        return False


def main() -> int:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    backup_dir = os.path.join(repo_root, "backups")
    os.makedirs(backup_dir, exist_ok=True)

    ts = now_ts()

    # 1) Archive mongo-data directory
    mongo_dir = os.path.join(repo_root, "mongo-data")
    mongo_archive = archive_mongo(mongo_dir, backup_dir, ts)
    if mongo_archive:
        print("MongoDB archive created:", mongo_archive, human_size(mongo_archive))
    else:
        print("MongoDB archive not created.")

    # 2) Copy SurrealDB file from container or volume
    container_name = os.getenv("SURREAL_CONTAINER", "quasar-vector-db")
    container_db_path = os.getenv("SURREAL_DB_PATH", "/data/quasar-vector.db")
    dest_db_path = os.path.join(backup_dir, f"quasar-vector-db-{ts}.db")

    ok = copy_surreal_from_container(container_name, container_db_path, dest_db_path)
    if not ok:
        print("Attempting to copy from Docker volume 'surrealdb_data'...")
        ok = copy_surreal_from_volume("surrealdb_data", dest_db_path)

    if ok:
        print("SurrealDB file backed up to:", dest_db_path, human_size(dest_db_path))
    else:
        print("Failed to back up SurrealDB. See messages above for details.")

    print("Backup directory contents:")
    for entry in sorted(os.listdir(backup_dir)):
        path = os.path.join(backup_dir, entry)
        print(" -", entry, human_size(path))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
