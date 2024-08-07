import json
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import fsspec

class RouteHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": "This is /jupyter_fsspec/hello endpoint!"
        }))

class ListFilesHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        fs = fsspec.filesystem('local')
        path = "./"
        files = fs.ls(path)
        self.finish(json.dumps({"files": files}))

def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "jupyter_fsspec", "hello")
    route_list_files = url_path_join(base_url, "jupyter_fsspec", "list_files")
    handlers = [(route_pattern, RouteHandler), (route_list_files, ListFilesHandler)]
    web_app.add_handlers(host_pattern, handlers)
