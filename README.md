# docker-wrap
This wraps the messy parts of the docker cli interface (such as parsing cli tables and getting the ids of created
entities) and tries to provide a simple and usable API for using docker programmatically.

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

### Generic Commands
On the instance you have access to a generic `cmd` method. You should normally only use this if you cant use
one of the pre-wrapped docker commands documented below, but it is useful to know since the commands all use
this internally and that is reflected in the structure of the response-object. The command invokes the docker
cli and provides back the results as a promise:

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

### `ps` Command
This wraps `docker ps` and is straightforward:

```js
const ps = await docker.ps();
if (ps.ok) console.log(ps.containers);
```

The `containers` property is an array of objects where each object has the properties given by docker.

### `hello` Command
This is just a simple wrapper for `docker run hello-world`, that you can use as a sanity-check to know
if docker-wrap is working:

```js
const hello = await docker.hello();
if (hello.ok) console.log(hello.output);
```

### `build` Command
This wraps `docker build` and allows you to build images:

```js
const build = await docker.build({ tag: '<my-tag>', cwd: '<root-of-docker-project' });
if (build.ok) console.log(build.id);
```

The `id` returned is the image id of the image just created.

The default filename for your Dockerfile is `Dockerfile` but you can specify it by setting the property `dockerfile`.

You can also specify the working folder with the `cwd` property.


### `images` Command
This wraps `docker images` and allows you to get the list of images:

```js
const images = await docker.images();
if (images.ok) console.log(images.images);
```

The `images` property is an array of objects where each object has the properties given by docker.


### `run` Command
This wraps `docker images` and allows you to run a container from an image:

```js
const run = await docker.run({ image: '<my-tag>', options: ['-p', '3000:3000'] });
if (run.ok) console.log(run.id);
```

The `id` property is the id of the newly started container.

Note that _this uses different defaults compared to docker cli_. By default it will run the container
"detached" and also _by default the container will be automatically removed when stopped_. To undo
this you can provide the `detach: false` and `remove: false` options.


### `kill` Command
This wraps `docker kill` and only takes the id of the container to kill:

```js
await docker.kill('my-id');
```

### `inspect`, `info`, `version` Commands
These are just simply wrapped methods of the respective docker commands, in all cases the response
object has the `output` property as a Javascript object for easy integration in your code.

### `search` Command
This searches Docker Hub for images and will return the list of search results as the `images`
property of the response object.

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

## Various

Author: Alex Scheel Meyer

License: MIT

