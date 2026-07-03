from pathlib import Path
import yaml

compose_path = Path("../../cornfield/deploy/minifridge-node.compose.yaml").resolve()
data = yaml.safe_load(compose_path.read_text())
service = data["services"]["node-minifridge"]
assert service["ports"] == ["127.0.0.1:8080:8080"]
assert service["environment"]["TURNSTONE_ADVERTISE_URL"] == "http://minifridge:8080"
print("compose validation ok")
