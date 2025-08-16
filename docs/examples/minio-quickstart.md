# Quickstart: S3‑compatible storage (MinIO, local)

This example shows how to explore an S3‑compatible bucket with **Jupyter fsspec** using a local MinIO server.

:::{note}
This quickstart complements the **Config File** and **Basic Usage** sections. It assumes you already have JupyterLab installed and that you will run MinIO locally with Docker.
:::

---

## Install required packages (one line)

```bash
pip install jupyter-fsspec s3fs
```

> If you already have JupyterLab, the command above just adds the fsspec extension and the S3 backend.

---

## Start MinIO locally (Docker)

```bash
# create a directory to store MinIO data
mkdir -p ~/minio-data

# run MinIO with S3 API on :9000 and Console on :9001
# credentials are set to the defaults below for local testing only
# (change them for anything beyond local dev)
docker run -d --name minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -v ~/minio-data:/data \
  minio/minio server /data --console-address ":9001"
```

- S3 API: `http://localhost:9000`
- Web console: `http://localhost:9001` (login: `minioadmin / minioadmin`)

Create a bucket in the console (e.g., **`test-bucket`**): **Buckets → Create bucket**.

---

## Configure the extension

Create or edit `~/.jupyter/jupyter-fsspec.yaml` and add a source for your MinIO bucket. This example assumes you made a bucket called `test-bucket`.

```yaml
# ~/.jupyter/jupyter-fsspec.yaml
sources:
  - name: 'MinIO (local)'
    path: 's3://test-bucket' # bucket you created
    args: []
    kwargs:
      # authentication for MinIO
      anon: false
      key: 'minioadmin'
      secret: 'minioadmin'

      # point s3fs at your local MinIO endpoint
      use_ssl: false
      client_kwargs:
        endpoint_url: 'http://127.0.0.1:9000'

      # ensure path-style URLs (works best on localhost) and v4 signing
      config_kwargs:
        signature_version: 's3v4'
        s3:
          addressing_style: 'path'
```

:::{note}

- `endpoint_url` directs `s3fs` to MinIO instead of AWS.
- `addressing_style: path` avoids `bucket.localhost` hostnames by using path‑style URLs.
- Keep `use_ssl: false` for local HTTP MinIO. If you terminate TLS, switch to `true` and use `https://` in `endpoint_url`.
  :::

---

## Use it in JupyterLab

Start JupyterLab. Open the **Jupyter fsspec** sidebar and select **"MinIO (local)"** to browse the bucket. Right‑click for actions such as copying the object path or uploading files (see **Uploading Files**).
