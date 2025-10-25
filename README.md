# golem-shopping-ts

This is a demo of a shopping app using Golem 1.3.

## Agents

- pricing: Pricing agent
- product: Product agent
- order: Order agent
- cart: Cart agent
- product-search: Product search agent


### Architecture Overview

The following diagram illustrates the high-level architecture of the Golem Shopping application:

![Golem Shopping Architecture](architecture.png)

*Figure 1: Golem Shopping Application Architecture*

To view or edit this diagram, see the `architecture.puml` file in the project root. The diagram can be rendered using any PlantUML-compatible tool.


## Quick Start

1. **Prerequisites**:
    - Install [Golem CLI](https://learn.golem.cloud/cli) (version 1.3.1)
    - [Running Golem Environment](https://learn.golem.cloud/quickstart#running-golem)

   See [Golem Quickstart](https://learn.golem.cloud/quickstart) for more information.

   **Note**: This project was developed and tested with Golem v1.3.1. For best results, please use this version.


2. **Build and Deploy**:
   ```bash
   # Build all components
   golem-cli app build
   
   # Deploy to Golem Network
   golem-cli app deploy
   ```

3. **Import Sample Data**:
   For information on importing sample data, see the [Data README](./data/README.md).

4. **Run the Frontend**:
   See the [Frontend README](./frontend/README.md) for detailed frontend setup and development instructions.
