from pydantic import BaseModel
from typing import Optional
from enum import Enum


class RequestType(str, Enum):
    default = "default"
    range = "range"


class RequestAction(str, Enum):
    move = "move"


class BaseRequest(BaseModel):
    key: str
    item_path: str


class GetRequest(BaseRequest):
    type: Optional[RequestType] = RequestType.default


class PostRequest(BaseRequest):
    content: Optional[str] = None
    action: Optional[RequestAction] = None
    base64: Optional[bool] = False


class DeleteRequest(BaseRequest):
    pass


class Direction(str, Enum):
    UPLOAD = "upload"
    DOWNLOAD = "download"


class TransferRequest(BaseModel):
    key: str
    destination_key: str
    local_path: str
    remote_path: str
    action: Direction
