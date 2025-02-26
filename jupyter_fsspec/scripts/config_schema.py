from jupyter_fsspec.models import Config
from pydantic.json_schema import models_json_schema
import yaml


def generate_config_schema():
    models = [Config]
    _, schemas = models_json_schema(
        [(model, "validation") for model in models],
        ref_template="#/components/schemas/{model}",
    )
    config_schema = {
        "info": {"title": "jupyter-fsspec API", "version": "0.4.0"},
        "components": {"schemas": schemas.get("$defs")},
    }
    config = yaml.dump(config_schema)
    print(config)


if __name__ == "__main__":
    generate_config_schema()
