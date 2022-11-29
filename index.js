import fs from 'fs';
import { spawn, spawnSync } from "child_process";
import tempfile from 'tempfile';

export class Container {
  constructor(attributes = {}, docker = null) {
    if (!docker) docker = new Docker();
    this._docker = docker;

    const { id = null, image = null, imageName = null, createdAt = null, startedAt = null, state = 'unknown' } = attributes;
    if (!id) throw new Error('Must supply an id for the container');

    this.id = id;
    this.image = image;
    this.imageName = imageName;
    this.createdAt = createdAt;
    this.startedAt = startedAt;
    this.state = state;
  }

  async kill() {
    return this._docker.kill(this.id);
  }
}


export class Image {
  constructor(attributes = {}, docker = null) {
    if (!docker) docker = new Docker();
    this._docker = docker;

    const { id = null, tags = [], createdAt = null, architecture = null, size = null } = attributes;
    if (!id) throw new Error('Must supply an id for the image');

    this.id = id;
    this.createdAt = createdAt;
    this.tags = tags;
    this.size = size;
    this.architecture = architecture;
  }
}


function parseJSONL(str) {
  const rows = str.split('\n').map((r) => {
    if (!r.length) return;
    return JSON.parse(r);
  }).filter((r) => r);

  return rows;
}

function getId(idString) {
  if (idString.startsWith('sha256:')) return idString.substring(7);
  return idString;
}

export default class Docker {
  static test() {
    const whichOut = spawnSync('which', ['docker']);
    if (whichOut.status === 0) {
      const versionOut = spawnSync('docker', ['version', '--format', '{{json .}}']);
      const version = JSON.parse(versionOut.stdout).Client.Version;
      return {
        path: whichOut.stdout.toString().trim(),
        version
      };
    }

    return null;
  }

  constructor(options = { echo: false, env: {} }) {
    this.echo = options.echo;
    this.env = {
      HOME: process.env.HOME,
      PATH: process.env.PATH,
      ...options.env
    };
  }

  async _containerFromId(id) {
    const output = await this.inspect(id);
    if (!output) return null;

    const [ info ] = output;
    return new Container({
      id,
      image: getId(info['Image']),
      imageName: info['Config']['Image'],
      createdAt: new Date(info['Created']),
      startedAt: new Date(info['State']['StartedAt']),
      state: info['State']['Status']
    }, this);
  }

  async _imageFromId(id) {
    const output = await this.inspect(id);
    if (!output) return null;

    const [ info ] = output;
    return new Image({
      id,
      tags: info['RepoTags'],
      createdAt: new Date(info['Created']),
      size: info['Size'],
      architecture: info['Architecture']
    }, this);
  }

  async cmd(cmdArgs, options = {}) {
    return new Promise((resolve, reject) => {
      const spawnOptions = {
        cwd: options.cwd || undefined,
        env: this.env
      };
      const command = spawn('docker', cmdArgs, spawnOptions);
      if (options.stdin) {
        command.stdin.write(options.stdin);
        command.stdin.end();
      }
      const outputChunks = [];
      const stdoutChunks = [];
      const stderrChunks = [];
      const log = (chunk) => {
        if (this.echo) console.log(chunk.toString());
      };
      command.stdout.on('data', (chunk) => { log(chunk); stdoutChunks.push(chunk); outputChunks.push(chunk); });
      command.stderr.on('data', (chunk) => { log(chunk); stderrChunks.push(chunk); outputChunks.push(chunk); });
      command.on('close', (status) => {
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
    return this.run({ image: 'hello-world', detach: false });
  }

  async ps(options = [] ) {
    const { ok, output, stdout, stderr } = await this.cmd(['ps', '--no-trunc', '--format', '{{json .}}'].concat(options));
    if (ok) {
      const rows = parseJSONL(output);
      const containers = [];
      // Here we inspect each of the ids we got to get computer-readable timestamps (rather than human-readable) and
      // other information not found in the regular "docker ps" output
      for (const row of rows) {
        const id = getId(row['ID']);
        const output = await this.inspect(id);
        let container;
        if (output) {
          container = await this._containerFromId(id);
        } else {
          // inspect failed, just make a container with the basic info
          container = new Container({
            id,
            imageName: row['Image'],
            state: row['State']
          }, this);
        }
        containers.push(container);
      }
      return containers;
    }
    return null;
  }

  async build({ tag = null, cwd = '.', dockerfile = 'Dockerfile', options = [] }) {
    const args = ['build'];
    if (tag) {
      args.push('-t');
      args.push(tag);
    }

    args.push('-f');
    args.push(dockerfile);

    const idFile = tempfile();
    args.push('--iidfile');
    args.push(idFile);

    args.push('.'); // we use cwd to specify folder, so from dockers perspective we are always building from current directory
    const out = await this.cmd(args, { cwd });

    return this._imageFromId(getId(fs.readFileSync(idFile).toString()));
  }

  async images(options = []) {
    const { ok, output, stdout, stderr, rows } = await this.cmd(['images', '--no-trunc', '--format', '{{json .}}'].concat(options));
    if (ok) {
      const rows = parseJSONL(output);
      const images = [];
      // Here we inspect each of the ids we got to get computer-readable timestamps (rather than human-readable) and
      // other information not found in the regular "docker images" output
      for (const row of rows) {
        const id = getId(row['ID']);
        let image = this._imageFromId(id);
        if (!image) {
          // inspect failed, just make an image with the basic info
          image = new Image({
            id
          }, this);
        }
        images.push(image);
      }
      return images;
    }
    return null;
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
    if (res.ok) {
      if (detach) {
        return await this._containerFromId(res.output.trim());
      } else {
        return res.output;
      }
    }
    console.log('FAILED', res);
    return null;
  }

  async kill(containerId) {
    return this.cmd(['kill', containerId]);
  }

  async inspect(nameOrId) {
    const { ok, output, stdout, stderr } = await this.cmd(['inspect', nameOrId]);
    if (ok) return JSON.parse(output);
    return null;
  }

  async info() {
    const { ok, output, stdout, stderr } = await this.cmd(['info', '--format', '{{json .}}']);
    if (ok) return JSON.parse(output);
    return null;
  }

  async version() {
    const { ok, output, stdout, stderr } = await this.cmd(['version', '--format', '{{json .}}']);
    if (ok) return JSON.parse(output);
    return null;
  }

  async search(term, options = []) {
    const { ok, output, stdout, stderr } = await this.cmd(['search', '--no-trunc', '--format', '{{json .}}', term].concat(options));
    if (ok) return parseJSONL(output);
    return null;
  }

  async login(username, password) {
    return this.cmd(['login', '--username', username, '--password-stdin'], { stdin: password });
  }

  async logout() {
    return this.cmd(['logout']);
  }
}
