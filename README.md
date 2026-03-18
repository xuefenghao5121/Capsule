# Capsule

> **Sandbox-centric AI Operating System**
> 
> 隔离、封装、独立单元

## 设计哲学

**Sandbox ≈ Process in Traditional OS**

正如传统操作系统管理进程，Capsule 管理沙箱 - AI Agent 的隔离执行环境。

```
Traditional OS          AI OS
───────────────────────────────────────
Process           →     Sandbox
Thread            →     Execution Flow
Scheduler         →     Sandbox Scheduler
Memory Manager    →     Resource Quota Manager
System Call       →     Tool Call
IPC               →     Sandbox Communication
```

## Core Concepts

### Sandbox

A sandbox is the fundamental isolation unit in AI OS:

- **Isolation Levels**: L0 (none), L1 (soft), L2 (hard)
- **Resource Quotas**: Inference budget, tokens, CPU, memory
- **Capabilities**: Explicit permission declarations

### Scheduler

Manages task scheduling and resource allocation:

- **Priority Queue**: REALTIME > HIGH > NORMAL > LOW > BATCH
- **Aging**: Prevents task starvation
- **Preemption**: Higher priority tasks can preempt

### Tools

Capability exposure interface:

- **Permission-based**: Explicit capability requirements
- **Risk Levels**: LOW, MEDIUM, HIGH, CRITICAL
- **Built-in Tools**: read, write, exec

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-os.git
cd ai-os/prototype

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

## Quick Start

```typescript
import { createAIOS, Capability, IsolationLevel } from "ai-os";

// Create an AI OS instance
const aiOS = createAIOS("./workspace");

// Start the system
await aiOS.start();

// Create a sandbox
const sandbox = await aiOS.sandboxManager.create({
  name: "my-agent",
  isolationLevel: IsolationLevel.L1,
  capabilities: [Capability.FILE_READ, Capability.FILE_WRITE, Capability.EXEC],
  quota: {
    maxInferencePerHour: 1000,
    maxTokensPerDay: 1000000,
    maxCpuPercent: 80,
    maxMemoryMB: 1024,
  },
});

// Use tools
const result = await aiOS.toolExecutor.execute(
  aiOS.toolRegistry.getByName("read")!,
  { path: "README.md" },
  sandbox
);

console.log(result.output);

// Cleanup
await aiOS.stop();
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│            WebSocket │ HTTP │ CLI │ SDK                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Sandbox Scheduling Layer                       │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │   Scheduler   │  │ Sandbox Mgr   │  │  Sandbox Pool │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Shared Infrastructure Layer                       │
│    Inference │ Memory │ Session │ Tools │ Monitoring            │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
prototype/
├── src/
│   ├── index.ts              # Entry point
│   ├── types/                # Type definitions
│   │   ├── sandbox.ts        # Sandbox types
│   │   ├── task.ts           # Task types
│   │   └── tool.ts           # Tool types
│   ├── sandbox/              # Sandbox core
│   │   ├── sandbox.ts        # Sandbox class
│   │   ├── manager.ts        # Lifecycle management
│   │   ├── workspace.ts      # Workspace management
│   │   └── isolation/        # Isolation implementations
│   ├── scheduler/            # Task scheduling
│   │   ├── scheduler.ts      # Scheduler core
│   │   ├── queue.ts          # Priority queue
│   │   └── policy.ts         # Scheduling policies
│   ├── tools/                # Tool system
│   │   ├── registry.ts       # Tool registry
│   │   ├── executor.ts       # Tool execution
│   │   └── builtins/         # Built-in tools
│   ├── session/              # Session management
│   │   ├── key.ts            # Session keys
│   │   └── store.ts          # Session persistence
│   ├── memory/               # Memory system
│   │   └── manager.ts        # Memory management
│   └── utils/                # Utilities
├── tests/                    # Test files
├── package.json
├── tsconfig.json
└── README.md
```

## Roadmap

### Phase 1 (W1-W4): Core Framework ✅

- [x] Sandbox core with L1 isolation
- [x] Priority-based scheduler
- [x] Tool registry and executor
- [x] Session and memory management

### Phase 2 (W5-W8): Advanced Features

- [ ] L2 isolation (Docker/WASM)
- [ ] Checkpoint and restore
- [ ] Monitoring and tracing
- [ ] Gateway API

### Phase 3 (W9-W12): Production Ready

- [ ] Multi-tenancy
- [ ] High availability
- [ ] Performance optimization
- [ ] Comprehensive documentation

## Contributing

Contributions are welcome! Please read our contributing guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## References

- Inspired by [OpenClaw](https://github.com/openclaw/openclaw)
- Design documentation in `docs/` directory

---

*Built by the Taiwei Team* 🦞