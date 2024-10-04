from jupyter_server.utils import url_path_join
import tornado.web
import pytest


from jupyter_fsspec.handlers import TestHandler


@pytest.fixture(scope="session")
async def server_app():
    app = tornado.web.Application()
    route_test_files = url_path_join("/jupyter_fsspec", "test")
    print("Entering fsspec handler")
    handlers = [(route_test_files, TestHandler)]
    app.add_handlers( ".*$", handlers)
    app.listen(8888)
    yield "http://localhost:8888/jupyter_fsspec/test"


