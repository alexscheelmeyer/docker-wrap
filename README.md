# docker-wrap
This wraps the messy parts of the docker cli interface (such as getting the output in computer-readable
format and getting the ids of created entities) and tries to provide a simple and usable API for using
docker programmatically.

## Warning
This does not currently do any input sanitization and forwards your inputs to the shell, so be sure to not
use user inputs for the arguments without sanitizing them first.

This will not install Docker for you, it is assumed to already be installed.

## Usage
This package uses es6 import syntax, so be sure to use Node >= V13.

```js
import Docker from 'docker-wrap';
```

With the `Docker` class you can make an instance where options are reused across commands. With the default
options:

```js
const docker = new Docker();
```

or with options set:


```js
const docker = new Docker({ echo: true, env: { HTTPS_PROXY: '<url>' });
```

Set the `echo` option to `true` if you want all the docker output to be echoed to stdout. This can be useful
for debugging or to have an audit-trail.

The default options are to have `echo = false` and the `HOME` and `PATH` environment variables to be mirrored.

You can also import `Container` and `Image` classes if you want to instantiate them yourself, in most cases
you will simply use them as output from the methods described below.

## Docker Commands

### `cmd`
On the instance you have access to a generic `cmd` method. You should normally only use this if you cant use
one of the pre-wrapped docker commands documented below, but it is useful to know since the commands all use
this internally and it can serve as a fallback if needed. The command invokes the docker cli and provides back
the results as a promise:

```js
const ps = await docker.cmd(['ps']);
```

The output object will contain these properties:

 - `ok`: whether the invocation succeeded
 - `output`: the entire output from docker, both stdout and stderr (in order)
 - `stdout`: just the stdout
 - `stderr`: just the stderr

You can also provide a second argument to the `cmd` method, the options argument can provide:

 - `cwd`: the folder to be used as current directory for the execution
 - `stdin`: any data that should be written to stdin of the command

For every command invocation, the outout, stdout and stderr values will also be stored on the instance as
`lastOutput`, `lastStdout` and `lastStderr` respectively. This allows you to debug the wrapped commands below
when they fail.

### `hello` Command
This is just a simple wrapper for `docker run hello-world`, that you can use as a sanity-check to know
if docker-wrap is working:

```js
const hello = await docker.hello();
if (hello) console.log(hello);
```

The response is the text output from running the `hello-world` image or `null` if it failed.

### `ps` Command
This wraps `docker ps` to get the currently running containers:

```js
const containers = await docker.ps();
```

The response is either `null` if the command failed or an array of `Container` objects.

The `Container` class will always contain the id (hash) for the container and a number of
other properties that might or might not be there:

 - `image`: the id (hash) of the image from which this container is created
 - `imageName`: the name of that image
 - `createdAt`: a `Date` with the time of when the container was created
 - `startedAt`: a `Date` with the time of when the container was started
 - `state`: a string description of the container state, typically "running" or "exited"

### `images` Command
This wraps `docker images` and allows you to get the list of images:

```js
const images = await docker.images();
```

The response is either `null` if the command failed or an array of `Image` objects.

The `Image` class will always contain the id (hash) for the image and a number of
other properties that might or might not be there:

 - `createdAt`: a `Date` with the time of when the image was created
 - `tags`: a list of the tags for this image
 - `size`: the size of the image in bytes
 - `architecture`: a string description of the image archecture such as "arm64" or "amd64"

### `build` Command
This wraps `docker build` and allows you to build images:

```js
const image = await docker.build({ tag: '<my-tag>', cwd: '<root-of-docker-project' });
```

The response is an instance of `Image` for the image just created.

The default filename for your Dockerfile is `Dockerfile` but you can specify it by setting the property `dockerfile`.

You can also specify the working folder with the `cwd` property.


### `run` Command
This wraps `docker run` and allows you to run a container from an image:

```js
const container = await docker.run({ image: '<my-tag>', options: ['-p', '3000:3000'] });
```

The response is either an instance of `Container` for the newly created container (if `detach: true`)
or the text output (stdout) of running the container (if `detach: false`).

Note that _this uses different defaults compared to docker cli_. By default it will run the container
"detached" and also _by default the container will be automatically removed when stopped_. To avoid
this you can provide the `detach: false` and `remove: false` options.


### `kill` Command
This wraps `docker kill` and only takes the id of the container to kill:

```js
await docker.kill('my-id');
```

You can also call `kill` on the container instance for the same effect, see below.

### `inspect`, `info`, `version` Commands
These are just simply wrapped methods of the respective docker commands, in all cases the response
is a Javascript object of the returned values.

If a command fails it will return `null`.

### `search` Command
This searches Docker Hub for images and will return the list of search results, or `null` if the
command failed.

### `login` and `logout` Commands
The `login` command wraps `docker login` _non-interactively_ for easy programmatic usage. It does this
by inputting the given password through stdin to make sure it does not end up in any shell logs. The
`logout` command is just provided for symmetry:

```js
const login = await docker.login(username, password);
if (login.ok) {
  // Do your thing
  await docker.logout();
}
```

### Static `test` method
On the Docker class object you can use the `test` method, it will try to figure out if docker is installed
(through running `which`) and if it is installed it will grab the version string:

```js
const dockerFound = Docker.test();
if (dockerFound) {
  console.log(`docker found in ${dockerFound.path} with version ${dockerFound.version}`);
}
```

## Container Methods

### `kill` Method
This is the same as `docker kill <container-id>`:

```js
await container.kill();
```

Note that this _will not update the state property of the container_, you should discard the instance and
create a new one if you need that.


## Various

Author: Alex Scheel Meyer

License: MIT

