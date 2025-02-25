from jupyter_fsspec.models import (
    BaseRequest,
    GetRequest,
    PostRequest,
    DeleteRequest,
    TransferRequest,
)
from pydantic.json_schema import models_json_schema
import yaml
import os


def write_json_schema(models):
    _, schemas = models_json_schema(
        [(model, "validation") for model in models],
        ref_template="#/components/schemas/{model}",
    )

    open_api_schema = {
        "openapi": "3.1.1",
        "info": {"title": "jupyter-fsspec API", "version": "0.4.0"},
        "components": {"schemas": schemas.get("$defs")},
    }

    cwd = os.getcwd()
    schema_file = os.path.join(cwd, "jupyter_fsspec/api_schema.yml")

    with open(schema_file, "w") as f:
        yaml.dump(open_api_schema, f)


if __name__ == "__main__":
    write_json_schema(
        [BaseRequest, GetRequest, PostRequest, DeleteRequest, TransferRequest]
    )
