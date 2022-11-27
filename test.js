import Docker from './index.js';

async function main() {
  const dockerFound = Docker.test();
  if (dockerFound) {
    console.log(`docker found in ${dockerFound.path} with version ${dockerFound.version}`);
  } else {
    process.exit(-1);
    return;
  }

  const docker = new Docker();
  const hello = await docker.hello();
  if (hello.ok) console.log(hello.output);

  const ps = await docker.ps();
  if (ps.ok) console.log(ps.containers);

  const build = await docker.build({ tag: 'githost-integration', cwd: '../saasless/git/' });
  if (build.ok) console.log(build.id);
  else console.error(build);

  const images = await docker.images();
  if (images.ok) console.log(images);

}

main();
