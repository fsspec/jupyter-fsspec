from jupyter_fsspec.models import (
    Config,
    BaseRequest,
    GetRequest,
    PostRequest,
    DeleteRequest,
    TransferRequest,
    ResponseErrorPayload,
    ResponseSuccessPayload,
)
from pydantic.json_schema import models_json_schema
from openapi_pydantic.v3 import OpenAPI, Info, PathItem, Operation
from openapi_pydantic.util import PydanticSchema, construct_open_api_with_schema_class
import yaml
import os


success_content = {
    "application/json": {"schema": PydanticSchema(schema_class=ResponseSuccessPayload)}
}

error_content = {
    "application/json": {"schema": PydanticSchema(schema_class=ResponseErrorPayload)}
}

response_error_codes = {
    "400": {
        "description": "Error with request payload information",
        "content": error_content,
    },
    "500": {"description": "Server operation error", "content": error_content},
}


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
                    description="List all source filesystems in configuration file",
                    responses={
                        "200": {
                            "description": "Retrieved available filesystems from configuration file.",
                            "content": {
                                "application/json": {
                                    "schema": PydanticSchema(schema_class=Config)
                                }
                            },
                        },
                        **response_error_codes,
                    },
                )
            ),
            "/jupyter_fsspec/files?{key}": PathItem(
                get=Operation(
                    description="List content at the specified path of the {key} filesystem",
                    parameters=[
                        {
                            "name": "key",
                            "in": "query",
                            "description": "Unique name identifying the filesystem",
                            "required": True,
                            "schema": {
                                "type": "string",
                            },
                        },
                    ],
                    requestBody={
                        "content": {
                            "application/json": {
                                "schema": PydanticSchema(schema_class=GetRequest)
                            }
                        }
                    },
                    responses={
                        "200": {
                            "description": "Retrieved content from item_path.",
                            "content": success_content,
                        },
                        **response_error_codes,
                    },
                ),
                post=Operation(
                    description="Create a file or directory based on provided content",
                    requestBody={
                        "content": {
                            "application/json": {
                                "schema": PydanticSchema(schema_class=PostRequest)
                            }
                        }
                    },
                    responses={
                        "200": {
                            "description": "Created file or directory in source filesystem",
                            "content": success_content,
                        },
                        **response_error_codes,
                    },
                ),
                put=Operation(
                    description="Update existing file",
                    requestBody={
                        "content": {
                            "application/json": {
                                "schema": PydanticSchema(schema_class=PostRequest)
                            }
                        }
                    },
                    responses={
                        "200": {
                            "description": "Update file at existing item_path",
                            "content": success_content,
                        },
                        **response_error_codes,
                    },
                ),
                delete=Operation(
                    description="Delete the file or directory specified by path",
                    requestBody={
                        "content": {
                            "application/json": {
                                "schema": PydanticSchema(schema_class=DeleteRequest)
                            }
                        }
                    },
                    responses={
                        "200": {
                            "description": "Delete path at item_path.",
                            "content": success_content,
                        },
                        **response_error_codes,
                    },
                ),
            ),
            "/jupyter_fsspec/files/action": PathItem(
                post=Operation(
                    description="Move or, by default, copy path to destination",
                    requestBody={
                        "content": {
                            "application/json": {
                                "schema": PydanticSchema(schema_class=PostRequest)
                            }
                        }
                    },
                    responses={
                        "200": {
                            "description": "Copied or moved item_path to destination specified by content.",
                            "content": success_content,
                        },
                        **response_error_codes,
                    },
                ),
            ),
            "/jupyter_fsspec/files/rename": PathItem(
                post=Operation(
                    description="Rename path to content provided",
                    requestBody={
                        "content": {
                            "application/json": {
                                "schema": PydanticSchema(schema_class=PostRequest)
                            }
                        }
                    },
                    responses={
                        "200": {
                            "description": "Renamed the specified item_path to content provided.",
                            "content": success_content,
                        },
                        **response_error_codes,
                    },
                ),
            ),
            "/jupyter_fsspec/files/transfer": PathItem(
                post=Operation(
                    description="Upload or download file(s) source path to destination path",
                    requestBody={
                        "content": {
                            "application/json": {
                                "schema": PydanticSchema(schema_class=TransferRequest)
                            }
                        }
                    },
                    responses={
                        "200": {
                            "description": "Downloaded or Uploaded from source path to destination path",
                            "content": success_content,
                        },
                        **response_error_codes,
                    },
                ),
            ),
        },
    )


open_api = base_openapi(
    [
        BaseRequest,
        GetRequest,
        PostRequest,
        DeleteRequest,
        TransferRequest,
        ResponseSuccessPayload,
        ResponseErrorPayload,
    ]
)
open_api = construct_open_api_with_schema_class(open_api)


if __name__ == "__main__":
    write_json_schema(open_api)
