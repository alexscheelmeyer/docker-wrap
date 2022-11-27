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

  const images = await docker.images();
  if (images.ok) console.log(images.images);

  const run = await docker.run({ image: 'githost-integration', options: ['-p', '2222:22', '-p', '3000:3000'] });
  if (run.ok) console.log(run.id);
  else console.error(run);


}

main();
