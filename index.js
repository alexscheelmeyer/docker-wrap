import fs from 'fs';
import { exec, spawn, spawnSync } from "child_process";
import { cliTable2Json } from "cli-table-2-json";
import tempfile from 'tempfile';

export default class Docker {
  static test() {
    const whichOut = spawnSync('which', ['docker']);
    if (whichOut.status === 0) {
      const versionOut = spawnSync('docker', ['--version']);
      const versionString = versionOut.stdout.toString();
      const versionStart = versionString.indexOf('version ') + 8;
      const versionEnd = versionString.indexOf(',');
      const version = versionString.substring(versionStart, versionEnd - 1);
      return {
        path: whichOut.stdout.toString().trim(),
        version
      };
    }

    return null;
  }

  constructor(options = { echo: false }) {
    this.echo = options.echo;
  }

  async _cmd(cmdArgs, options = {}) {
    return new Promise((resolve, reject) => {
      const spawnOptions = {
        cwd: options.cwd || undefined
      };
      const helloCmd = spawn('docker', cmdArgs, spawnOptions);
      const outputChunks = [];
      const stdoutChunks = [];
      const stderrChunks = [];
      const log = (chunk) => {
        if (this.echo) console.log(chunk.toString());
      };
      helloCmd.stdout.on('data', (chunk) => { log(chunk); stdoutChunks.push(chunk); outputChunks.push(chunk); });
      helloCmd.stderr.on('data', (chunk) => { log(chunk); stderrChunks.push(chunk); outputChunks.push(chunk); });
      helloCmd.on('close', (status) => {
        const output = outputChunks.join('');
        const stdout = stdoutChunks.join('');
        const stderr = stderrChunks.join('');
        resolve({
          ok: status === 0,
          output,
          stdout,
          stderr
        });
      });
    });
  }

  async hello() {
    return this._cmd(['run', 'hello-world']);
  }

  async ps(options = [] ) {
    const psOut = await this._cmd(['ps', '--no-trunc'].concat(options));
    if (!psOut.ok) return psOut;

    let ok = true; // at this point we have succes from running the command
    let containers = [];
    try {
      const lines = psOut.stdout.split(/\r?\n/);
      containers = cliTable2Json(lines);
    } catch(e) {
      ok = false; // we somehow failed to parse the output
    }
    return {
      ok: true,
      output: psOut.output,
      stdout: psOut.stdout,
      stderr: psOut.stderr,
      containers
    };
  }

  async build({ tag = null, cwd = '.', dockerfile = 'Dockerfile', options = [], noId = false }) {
    const args = ['build'];
    if (tag) {
      args.push('-t');
      args.push(tag);
    }

    args.push('-f');
    args.push(dockerfile);

    let idFile = null;
    if (!noId) {
      args.push('--iidfile');
      idFile = tempfile();
      args.push(idFile);
    }

    args.push('.');
    const out = await this._cmd(args, { cwd });

    if (idFile) {
      out.id = fs.readFileSync(idFile).toString();
    }

    return out;
  }

}
