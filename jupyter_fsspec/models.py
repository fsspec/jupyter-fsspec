from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from enum import Enum


class Source(BaseModel):
    """Filesystem configurations passed to fsspec"""

    name: str
    path: str
    protocol: Optional[str] = None
    args: Optional[List] = []
    kwargs: Optional[Dict] = {}


class Config(BaseModel):
    """A list of source filesystem configurations"""

    sources: List[Source]


class RequestType(str, Enum):
    default = "default"
    range = "range"


class RequestAction(str, Enum):
    move = "move"


class BaseRequest(BaseModel):
    """
    The required information for all Filesystem handler endpoints.

    key: unique
    item_path: destination path for the acting filesystem
    """

    key: str = Field(
        ...,
        title="Filesystem name",
        description="Unique identifier given as the filesystem 'name' in the config file",
    )
    item_path: str = Field(..., title="Path", description="Acting path in filesystem")


class GetRequest(BaseRequest):
    """
    GET request specific items.

    type: option to specify type of GET request
    """

    type: Optional[RequestType] = Field(
        default=RequestType.default,
        title="Type of GET request",
        description="Either a 'range' GET request for file or 'default' for normal GET",
    )


class PostRequest(BaseRequest):
    """
    POST request specific items.

    content: content to be created upon request
    action: move action specified when calling action handler
    """

    content: Optional[str] = Field(
        default=None,
        title="File content or file/directory name",
        description="Content to be created upon request",
    )
    action: Optional[RequestAction] = Field(
        default=None,
        title="Move or copy action indicator",
        description="Specify 'move' action when calling action handler, default treated as copy",
    )
    base64: Optional[bool] = Field(
        default=False,
        title="Base64 content payload",
        description="Indicate base64 content in request payload",
    )


class DeleteRequest(BaseRequest):
    """
    Placeholder model for delete request

    No additional information is needed than base request
    """

    pass


class Direction(str, Enum):
    UPLOAD = "upload"
    DOWNLOAD = "download"


class TransferRequest(BaseModel):
    """
    Requests made to download, upload and sync.

    key: unique
    destination_key: unique
    local_path: file/directory path, filesystem root path for sync
    remote_path: file/directory path, filesystem root path for sync
    action: enum option upload or download
    """

    key: str = Field(
        title="Source filesystem name",
        description="Unique identifier given as the filesystem 'name' in the config file",
    )
    destination_key: str = Field(
        title="Destination filesystem name",
        description="Unique identifier given as the filesystem 'name' in the config file",
    )
    local_path: str
    remote_path: str
    action: Direction = Field(
        title="Transfer direction",
        description="Can be 'upload' or 'download for local to remote or remote to local respectively",
    )
