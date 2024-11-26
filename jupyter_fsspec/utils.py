import re


def parse_range(range_header):
    if not range_header:
        return None, None  # TODO: No range specified

    match = re.match(r"(\d+)-(\d+)?", range_header)
    if not match:
        raise ValueError("Invalid Range header format")

    start = int(match.group(1))
    end = match.group(2)

    if end is None:
        end = None  # TODO: set upper limit to file size

    return start, end
