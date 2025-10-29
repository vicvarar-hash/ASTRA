# ASTRA - Authorization with Semantic Task-based Restricted Access

> You can find out more on the [overview page here](https://outshift-open.github.io/ASTRA), or read the [full paper here](https://arxiv.org/).

This repository contains an an open-source dataset for task-tool matching in the context of delegated authorization flows, as described in our [paper](https://arxiv.org/). The core data resides in the `data/` directory, which is divided by task complexity: `01_tool`, `02_tools`, and `03_tools` contain datasets for tasks requiring one, two, or three tools, respectively. Each of these directories is further split into `ASTRA` (our generated data) and `TOUCAN` (processed [TOUCAN](https://arxiv.org/abs/2510.01179) data), with files for generated tasks, validation, and test splits, or processed tasks and test data respectively. The `mcp_servers/` folder holds the MCP Server configuration files used in data generation, separated for `ASTRA` and `TOUCAN` sources and containing JSON files for each server.

## Key Features

- **Synthetic Multi-Tool Tasks**: Agentic tasks are generated using real-world MCP Servers (e.g., Wikipedia, GitHub) with sets of $N$ tools ($N \in [1, 2, 3]$), ensuring semantic coherence and realism.
- **Simulated Tool Matching**: Includes both correct and simulated incorrect tool matches:
  - Wrong matches: Tools from the same MCP Server
  - Null matches: Tools from different MCP Servers
- **TOUCAN Data Integration**: Curated and pre-processed subset of the [TOUCAN dataset](https://github.com/TheAgentArk/Toucan) for direct comparison, with consistent formatting and quality controls.
- **Comprehensive Metadata**: All tool names, descriptions (with arguments removed), and server metadata are included.

## Data Overview

- **Enterprise MCP Servers**: 12 high-quality, English-only servers, covering a range of 10-90 tools each.
- **Synthetic Tasks**: $352 \times 3$ tasks per $N \in [1, 2, 3]$ for our dataset; 1,056 processed tasks per $N$ for Toucan.
- **Validation Ready**: Processed, de-duplicated, and filtered for high data quality.

## Citation

If you use this dataset then please cite our [paper](https://arxiv.org/).

## Repository Structure

```
ASTRA/
├── README.md                         # Project documentation
├── LICENSE                           # License information
├── data/                             # Dataset
│   │
│   ├── 01_tool/                      # Data for single tool tasks
│   │   ├── ASTRA/                    # ASTRA-generated data
│   │   │   ├── generated.json        # Generated tasks for MCP Server tools
│   │   │   ├── test.json             # Test data split
│   │   │   └── validation.json       # Validation data split
│   │   └── TOUCAN/                   # TOUCAN-processed data
│   │       ├── processed.json        # Processed tasks for MCP Server tools
│   │       └── test.json             # Test data
│   │
│   ├── 02_tools/                     # Data for tasks with two tools...
│   │   ├── ASTRA/                    # ...following the same structure as above
│   │   │   ├── generated.json
│   │   │   ├── test.json
│   │   │   └── validation.json
│   │   └── TOUCAN/
│   │       ├── processed.json
│   │       └── test.json
│   │
│   ├── 03_tools/                     # Data for tasks with three tools...
│   │   ├── ASTRA/                    # ...following the same structure as above
│   │   │   ├── generated.json
│   │   │   ├── test.json
│   │   │   └── validation.json
│   │   └── TOUCAN/
│   │       ├── processed.json
│   │       └── test.json
│   │
│   └── mcp_servers/                  # MCP Server configurations
│       ├── ASTRA/                    # ASTRA MCP Server configs
│       │   ├── atlassian.json
│       │   ├── azure.json
│       │   └── ... (additional servers)
│       └── TOUCAN/                   # TOUCAN MCP Server configs
│           ├── After Effects MCP Server.json
│           ├── AI Research Assistant - Semantic Scholar.json
│           └── ... (additional servers)
```

## Roadmap

See the [open issues](https://github.com/outshift-open/ASTRA/issues) for a list
of proposed features (and known issues).

## Contributing

Contributions are what make the open source community such an amazing place to
learn, inspire, and create. Any contributions you make are **greatly
appreciated**. For detailed contributing guidelines, please see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Copyright Notice

[Copyright Notice and License](LICENSE)

Distributed under Apache 2.0 License. See LICENSE for more information.

Copyright [Cisco Systems, Inc. and its affiliates](https://github.com/outshift-open).
