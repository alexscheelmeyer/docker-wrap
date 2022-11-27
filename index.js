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

  async cmd(cmdArgs, options = {}) {
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

  async _tableCmd(cmdArgs, options = {}) {
    const cmdOut = await this.cmd(cmdArgs, options);
    if (!cmdOut.ok) return cmdOut;

    let ok = true; // at this point we have succes from running the command
    let rows = [];
    try {
      const lines = cmdOut.stdout.split(/\r?\n/);
      rows = cliTable2Json(lines);
    } catch(e) {
      ok = false; // we somehow failed to parse the output
    }
    return {
      ok,
      output: cmdOut.output,
      stdout: cmdOut.stdout,
      stderr: cmdOut.stderr,
      rows
    };
  }

  async hello() {
    return this.run({ image: 'hello-world', detach: false });
  }

  async ps(options = [] ) {
    const { ok, output, stdout, stderr, rows } = await this._tableCmd(['ps', '--no-trunc'].concat(options));
    return { ok, output, stdout, stderr, containers: rows };
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

    args.push('.'); // we use cwd to specify folder, so from dockers perspective we are always building from current directory
    const out = await this.cmd(args, { cwd });

    if (idFile) {
      out.id = fs.readFileSync(idFile).toString();
    }

    return out;
  }

  async images(options = []) {
    const { ok, output, stdout, stderr, rows } = await this._tableCmd(['images', '--no-trunc'].concat(options));
    return { ok, output, stdout, stderr, images: rows };
  }

  async run({ image = null, detach = true, remove = true, options = [] }) {
    if (!image) throw new Error('Docker run needs a tag or id for the image to run');

    let args = ['run'];

    if (detach) {
      args.push('-d');
    }

    if (detach) {
      args.push('--rm');
    }

    args = args.concat(options);

    args.push(image);

    const res = await this.cmd(args);
    if (res.ok) res.id = res.output.trim();
    return res;
  }

  async kill(containerId) {
    return this.cmd(['kill', containerId]);
  }

}
