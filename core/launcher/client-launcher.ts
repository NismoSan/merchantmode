// @ts-nocheck -- koffi FFI types don't have complete TS definitions
import koffi from 'koffi';
import path from 'path';

// ─── Win32 Type Definitions ───

const SECURITY_ATTRIBUTES = koffi.struct('SECURITY_ATTRIBUTES', {
  nLength: 'uint32',
  lpSecurityDescriptor: 'void *',
  bInheritHandle: 'int',
});

const STARTUPINFOW = koffi.struct('STARTUPINFOW', {
  cb: 'uint32',
  lpReserved: 'void *',
  lpDesktop: 'void *',
  lpTitle: 'void *',
  dwX: 'uint32',
  dwY: 'uint32',
  dwXSize: 'uint32',
  dwYSize: 'uint32',
  dwXCountChars: 'uint32',
  dwYCountChars: 'uint32',
  dwFillAttribute: 'uint32',
  dwFlags: 'uint32',
  wShowWindow: 'uint16',
  cbReserved2: 'uint16',
  lpReserved2: 'void *',
  hStdInput: 'void *',
  hStdOutput: 'void *',
  hStdError: 'void *',
});

const PROCESS_INFORMATION = koffi.struct('PROCESS_INFORMATION', {
  hProcess: 'void *',
  hThread: 'void *',
  dwProcessId: 'uint32',
  dwThreadId: 'uint32',
});

// ─── Win32 Constants ───

const CREATE_SUSPENDED = 0x00000004;
const PROCESS_ALL_ACCESS = 0x001FFFFF;
const MEM_COMMIT = 0x00001000;
const PAGE_READWRITE = 0x04;

// ─── Win32 Function Bindings ───

const kernel32 = koffi.load('kernel32.dll');

const CreateProcessW = kernel32.func('CreateProcessW', 'int', [
  'str16',                              // lpApplicationName
  'str16',                              // lpCommandLine
  koffi.pointer(SECURITY_ATTRIBUTES),   // lpProcessAttributes
  koffi.pointer(SECURITY_ATTRIBUTES),   // lpThreadAttributes
  'int',                                // bInheritHandles
  'uint32',                             // dwCreationFlags
  'void *',                             // lpEnvironment
  'str16',                              // lpCurrentDirectory
  koffi.pointer(STARTUPINFOW),          // lpStartupInfo
  koffi.out(koffi.pointer(PROCESS_INFORMATION)), // lpProcessInformation
]);

const OpenProcess = kernel32.func('OpenProcess', 'void *', ['uint32', 'int', 'uint32']);
const CloseHandle = kernel32.func('CloseHandle', 'int', ['void *']);
const ResumeThread = kernel32.func('ResumeThread', 'uint32', ['void *']);
const TerminateProcess = kernel32.func('TerminateProcess', 'int', ['void *', 'uint32']);

const WriteProcessMemory = kernel32.func('WriteProcessMemory', 'int', [
  'void *',   // hProcess
  'uintptr',  // lpBaseAddress (as integer address)
  'void *',   // lpBuffer
  'uintptr',  // nSize
  koffi.out(koffi.pointer('uintptr')), // lpNumberOfBytesWritten
]);

const ReadProcessMemory = kernel32.func('ReadProcessMemory', 'int', [
  'void *',   // hProcess
  'uintptr',  // lpBaseAddress
  'void *',   // lpBuffer (output)
  'uintptr',  // nSize
  koffi.out(koffi.pointer('uintptr')), // lpNumberOfBytesRead
]);

const VirtualAllocEx = kernel32.func('VirtualAllocEx', 'uintptr', [
  'void *',   // hProcess
  'uintptr',  // lpAddress
  'uintptr',  // dwSize
  'uint32',   // flAllocationType
  'uint32',   // flProtect
]);

// ─── DA Client Patch Addresses (v7.41) ───

const MULTIPLE_INSTANCE_PATCH_ADDR = 0x57A7CE;
const SKIP_INTRO_PATCH_ADDR = 0x42E61F;
const SERVER_HOSTNAME_PATCH_ADDRS = [0x433392, 0x565628];
const SERVER_FALLBACK_IP_PATCH_ADDR = 0x4333C3;
const SERVER_PORT_PATCH_ADDR = 0x4333E3;
const CHARACTER_NAME_ADDR = 0x73D910;
const CHARACTER_NAME_LENGTH = 12;

// ─── Helper Functions ───

function writeBytes(hProcess: any, address: number, bytes: number[]): void {
  const buf = Buffer.from(bytes);
  const bytesWritten = [0];
  const result = WriteProcessMemory(hProcess, address, buf, buf.length, bytesWritten);
  if (!result) {
    throw new Error(`WriteProcessMemory failed at 0x${address.toString(16)}`);
  }
}

function allocAndWriteString(hProcess: any, str: string): number {
  const strBuf = Buffer.from(str + '\0', 'ascii');
  const remoteMem = VirtualAllocEx(hProcess, 0, strBuf.length, MEM_COMMIT, PAGE_READWRITE);
  if (!remoteMem) {
    throw new Error('VirtualAllocEx failed');
  }

  const bytesWritten = [0];
  const result = WriteProcessMemory(hProcess, remoteMem, strBuf, strBuf.length, bytesWritten);
  if (!result) {
    throw new Error('WriteProcessMemory failed for string allocation');
  }

  return remoteMem;
}

function writeUint32LE(hProcess: any, address: number, value: number): void {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  const bytesWritten = [0];
  WriteProcessMemory(hProcess, address, buf, 4, bytesWritten);
}

// ─── Patch Functions (matching Arbiter exactly) ───

function applyMultipleInstancePatch(hProcess: any): void {
  writeBytes(hProcess, MULTIPLE_INSTANCE_PATCH_ADDR, [
    0x31, 0xC0, // XOR EAX, EAX
    0x90, 0x90, 0x90, 0x90, // NOP x4
  ]);
  console.log('[Launcher] Applied multiple instance patch');
}

function applySkipIntroPatch(hProcess: any): void {
  writeBytes(hProcess, SKIP_INTRO_PATCH_ADDR, [
    0x83, 0xFA, 0x00, // CMP EDX, 0
    0x90, 0x90, 0x90, // NOP x3
  ]);
  console.log('[Launcher] Applied skip intro patch');
}

function applyServerEndpointPatch(hProcess: any, hostnamePtr: number, port: number): void {
  for (const addr of SERVER_HOSTNAME_PATCH_ADDRS) {
    writeUint32LE(hProcess, addr, hostnamePtr);
  }

  writeBytes(hProcess, SERVER_PORT_PATCH_ADDR, [
    0xBA, // MOV EDX, imm32
    port & 0xFF,
    (port >> 8) & 0xFF,
    0x00,
    0x00,
  ]);

  // Patch fallback IP to 127.0.0.1 (reversed for RTL PUSH convention)
  writeBytes(hProcess, SERVER_FALLBACK_IP_PATCH_ADDR, [
    0x6A, 1,   // PUSH 1
    0x6A, 0,   // PUSH 0
    0x6A, 0,   // PUSH 0
    0x6A, 127, // PUSH 127
  ]);

  console.log(`[Launcher] Applied server endpoint patch -> localhost:${port}`);
}

// ─── Public API ───

export interface LaunchOptions {
  localPort?: number;
  skipIntro?: boolean;
}

export interface LaunchedClient {
  processId: number;
  hProcess: any;
  hThread: any;
}

export function launchClient(clientExePath: string, options: LaunchOptions = {}): LaunchedClient {
  const port = options.localPort || 2610;
  const skipIntro = options.skipIntro !== false;

  console.log(`[Launcher] Launching: ${clientExePath}`);

  const si = {
    cb: 104, lpReserved: null, lpDesktop: null, lpTitle: null,
    dwX: 0, dwY: 0, dwXSize: 0, dwYSize: 0,
    dwXCountChars: 0, dwYCountChars: 0, dwFillAttribute: 0,
    dwFlags: 0, wShowWindow: 0, cbReserved2: 0, lpReserved2: null,
    hStdInput: null, hStdOutput: null, hStdError: null,
  };

  const sa = { nLength: 24, lpSecurityDescriptor: null, bInheritHandle: 0 };
  const pi = { hProcess: null, hThread: null, dwProcessId: 0, dwThreadId: 0 };
  const workDir = path.dirname(clientExePath);

  const result = CreateProcessW(clientExePath, null, sa, sa, 0, CREATE_SUSPENDED, null, workDir, si, pi);

  if (!result || pi.dwProcessId === 0) {
    throw new Error(`CreateProcess failed for ${clientExePath}`);
  }

  console.log(`[Launcher] Process created (PID: ${pi.dwProcessId}), suspended`);

  const hProcess = OpenProcess(PROCESS_ALL_ACCESS, 0, pi.dwProcessId);
  if (!hProcess) {
    throw new Error('OpenProcess failed');
  }

  try {
    applyMultipleInstancePatch(hProcess);
    if (skipIntro) applySkipIntroPatch(hProcess);

    const hostnamePtr = allocAndWriteString(hProcess, 'localhost');
    applyServerEndpointPatch(hProcess, hostnamePtr, port);

    console.log('[Launcher] All patches applied, resuming thread');
  } catch (err) {
    TerminateProcess(hProcess, 1);
    CloseHandle(hProcess);
    CloseHandle(pi.hThread);
    throw err;
  }

  ResumeThread(pi.hThread);

  return {
    processId: pi.dwProcessId,
    hProcess,
    hThread: pi.hThread,
  };
}

export function readCharacterName(processId: number): string {
  const hProcess = OpenProcess(0x0010 | 0x0400, 0, processId);
  if (!hProcess) return '';

  try {
    const buf = Buffer.alloc(CHARACTER_NAME_LENGTH + 1);
    const bytesRead = [0];
    const result = ReadProcessMemory(hProcess, CHARACTER_NAME_ADDR, buf, CHARACTER_NAME_LENGTH, bytesRead);
    if (!result) return '';

    const nullIdx = buf.indexOf(0);
    return buf.subarray(0, nullIdx > 0 ? nullIdx : CHARACTER_NAME_LENGTH).toString('ascii');
  } finally {
    CloseHandle(hProcess);
  }
}

export function closeClientHandles(client: LaunchedClient): void {
  if (client.hProcess) CloseHandle(client.hProcess);
  if (client.hThread) CloseHandle(client.hThread);
}
