import base64
import re


def parse_range(range_header):
    if not range_header:
        return None, None  # TODO: No range specified

    match = re.match(r"(\d+)-(\d+)?", range_header)
    if not match:
        raise ValueError("Invalid Range header format")

    start = int(match.group(1))
    end = int(match.group(2))

    if end is None:
        end = None  # TODO: set upper limit to file size

    return start, end


def load_image_as_base64(image_path):
    """Reads an image file and encodes it as a Base64 string."""
    with open(image_path, "rb") as img_file:
        return base64.b64encode(img_file.read()).decode("utf-8")
