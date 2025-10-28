# ASTRA - Authorization with Semantic Task-based Restricted Access 

[Landing Page](https://outshift-open.github.io/ASTRA)

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
│   │       └── validation.json       # Validation data
│   │
│   ├── 02_tools/                     # Data for tasks with two tools...
│   │   ├── ASTRA/                    # ...following the same structure as above
│   │   │   ├── generated.json
│   │   │   ├── test.json
│   │   │   └── validation.json
│   │   └── TOUCAN/
│   │       ├── processed.json
│   │       └── validation.json
│   │
│   ├── 03_tools/                     # Data for tasks with three tools...
│   │   ├── ASTRA/                    # ...following the same structure as above
│   │   │   ├── generated.json
│   │   │   ├── test.json
│   │   │   └── validation.json
│   │   └── TOUCAN/
│   │       ├── processed.json
│   │       └── validation.json
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
