# Capsule

> **Sandbox-centric AI Operating System**
> 
> 隔离、封装、独立单元

## 设计哲学

**Sandbox ≈ Process in Traditional OS**

正如传统操作系统管理进程，Capsule 管理沙箱 - AI Agent 的隔离执行环境。

```
Traditional OS          Capsule
───────────────────────────────────────
Process           →     Sandbox
Thread            →     Execution Flow
Scheduler         →     Sandbox Scheduler
Memory Manager    →     Resource Quota Manager
System Call       →     Tool Call
IPC               →     Sandbox Communication
```

## 核心特性

| 特性 | 说明 |
|------|------|
| **分层隔离** | L0 (无隔离) / L1 (进程级) / L2 (Docker) |
| **资源配额** | 推理预算、Token、CPU、内存限制 |
| **优先级调度** | 实时 → 高 → 普通 → 低 → 批处理 |
| **工具系统** | 能力声明 + 风险级别 + 权限控制 |
| **多租户** | 租户隔离 + 配额管理 |
| **高可用** | 健康检查 + 存活探针 + 就绪探针 |

## 安装

```bash
# Clone the repository
git clone https://github.com/xuefenghao5121/Capsule.git
cd Capsule

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## 快速开始

```typescript
import { createCapsule, IsolationLevel } from "capsule";

// Create Capsule instance
const capsule = createCapsule("./workspace");

// Start the system
await capsule.start();

// Create a sandbox
const sandbox = await capsule.sandboxManager.create({
  name: "my-agent",
  isolationLevel: IsolationLevel.L1,
  capabilities: ["file_read", "file_write", "exec"],
  quota: {
    maxInferencePerHour: 1000,
    maxTokensPerDay: 1000000,
    maxCpuPercent: 80,
    maxMemoryMB: 1024,
  },
});

// Use tools
const result = await capsule.toolExecutor.execute(
  capsule.toolRegistry.getByName("read")!,
  { path: "README.md" },
  sandbox
);

console.log(result.output);

// Cleanup
await capsule.stop();
```

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Gateway Layer                               │
│            WebSocket (JSON-RPC) + HTTP API                      │
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
│  Inference │ Memory │ Session │ Tools │ Tenant │ Health         │
└─────────────────────────────────────────────────────────────────┘
```

## 项目结构

```
src/
├── index.ts              # Entry point
├── types/                # Type definitions
├── sandbox/              # Sandbox core
│   ├── sandbox.ts        # Sandbox class
│   ├── manager.ts        # Lifecycle management
│   ├── workspace.ts      # Workspace management
│   ├── checkpoint.ts     # State persistence
│   └── isolation/        # Isolation implementations
│       ├── process.ts    # L1 process isolation
│       └── docker.ts     # L2 Docker isolation
├── scheduler/            # Task scheduling
│   ├── scheduler.ts      # Scheduler core
│   ├── queue.ts          # Priority queue
│   └── policy.ts         # Scheduling policies
├── tools/                # Tool system
│   ├── registry.ts       # Tool registry
│   ├── executor.ts       # Tool execution
│   └── builtins/         # Built-in tools
├── session/              # Session management
├── memory/               # Memory system
├── telemetry/            # Metrics, traces, logs
├── gateway/              # WebSocket + HTTP API
├── tenant/               # Multi-tenancy
├── health/               # Health checks
└── perf/                 # Performance utilities
```

## API

### Sandbox

```typescript
// Create sandbox
const sandbox = await manager.create({
  name: "agent-1",
  isolationLevel: IsolationLevel.L1,
  capabilities: ["file_read", "file_write", "exec"],
  quota: { maxInferencePerHour: 1000, ... }
});

// Check capabilities
sandbox.hasCapability("exec"); // true/false

// Check quota
sandbox.checkQuota({ inference: 1, tokens: 100 }); // true/false

// State transitions
sandbox.transition(SandboxStatus.RUNNING);
```

### Scheduler

```typescript
// Submit task
await scheduler.submit(task);

// Set priority
await scheduler.setPriority(sandbox, Priority.HIGH);

// Get queue
const queue = await scheduler.getQueue();
```

### Tools

```typescript
// Register tool
registry.register(myTool);

// Execute tool
const result = await executor.execute(tool, input, sandbox);
```

## 路线图

### Phase 1: Core Framework ✅
- [x] Sandbox core with L1 isolation
- [x] Priority-based scheduler
- [x] Tool registry and executor
- [x] Session and memory management

### Phase 2: Advanced Features ✅
- [x] L2 isolation (Docker)
- [x] Checkpoint and restore
- [x] Monitoring and tracing
- [x] Gateway API

### Phase 3: Production Ready ✅
- [x] Multi-tenancy
- [x] High availability
- [x] Performance optimization

## 贡献

Contributions are welcome! Please read our contributing guidelines.

## 许可证

MIT License - see [LICENSE](LICENSE) for details.

## 参考资料

- Inspired by [OpenClaw](https://github.com/openclaw/openclaw)
- Design documentation in `docs/` directory

---

*Built by the Taiwei Team* 🦞

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