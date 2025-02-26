from jupyter_fsspec.models import (
    Config,
    BaseRequest,
    GetRequest,
    PostRequest,
    DeleteRequest,
    TransferRequest,
)
from pydantic.json_schema import models_json_schema
from openapi_pydantic.v3 import OpenAPI, Info, PathItem, Operation
from openapi_pydantic.util import PydanticSchema, construct_open_api_with_schema_class
import yaml
import os


def write_json_schema(openapi):
    cwd = os.getcwd()
    schema_file = os.path.join(cwd, "jupyter_fsspec/api_schema.yml")

    with open(schema_file, "w") as f:
        f.write(
            yaml.dump(
                openapi.model_dump(
                    by_alias=True,
                    mode="json",
                    exclude_none=True,
                    exclude_unset=True,
                ),
                sort_keys=False,
            )
        )


def base_openapi(models) -> OpenAPI:
    _, schemas = models_json_schema(
        [(model, "validation") for model in models],
        ref_template="#/components/schemas/{model}",
    )

    return OpenAPI(
        openapi="3.1.0",
        info=Info(title="jupyter-fsspec API", version="0.4.0"),
        components={"schemas": schemas.get("$defs")},
        paths={
            "/jupyter_fsspec/config": PathItem(
                get=Operation(
                    operationId="listConfigSources",
                    description="List all source filesystems in configuration file",
                    responses={
                        "200": {
                            "description": "Retrieved available filesystems from configuration file.",
                            "content": {
                                "application/json": {
                                    "schema": PydanticSchema(schema_class=Config)
                                }
                            },
                        }
                    },
                )
            ),
        },
    )


open_api = base_openapi(
    [BaseRequest, GetRequest, PostRequest, DeleteRequest, TransferRequest]
)
open_api = construct_open_api_with_schema_class(open_api)


if __name__ == "__main__":
    write_json_schema(open_api)
