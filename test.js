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
  if (hello) console.log(hello);

  const containers = await docker.ps();
  if (containers) console.log(containers[0].toString());

  const buildImage = await docker.build({ tag: 'githost-integration', cwd: '../saasless/git/' });
  if (buildImage) console.log(buildImage.toString());

  const images = await docker.images();
  if (images) console.log(images.length);

  const runningContainer = await docker.run({ image: 'githost-integration', options: ['-p', '2222:22', '-p', '3000:3000'] });
  if (runningContainer) {
    console.log(runningContainer);
    await runningContainer.kill();
  }

  const inspect = await docker.inspect('hello-world');
  if (inspect) console.log(inspect);

  const info = await docker.info();
  if (info) console.log(info);

  const version = await docker.version();
  if (version) console.log(version);

  const results = await docker.search('nginx');
  if (results) console.log(results);

  const login = await docker.login(process.env.USER, process.env.PW);
  if (login.ok) {
    await docker.logout();
  }
}

main();
