/**
 * Built-in tools index
 */

export { readTool } from "./read.js";
export { writeTool } from "./write.js";
export { execTool } from "./exec.js";

import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { execTool } from "./exec.js";
import { Tool } from "../../types/tool.js";

/**
 * All built-in tools
 */
export const builtInTools: Tool[] = [readTool, writeTool, execTool];