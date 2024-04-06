import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { parse } from 'yaml'
import {
  generatePiGenConfigFile,
  buildImageUsingConfigFile,
} from './pigen.js';
import { OnePasswordVault } from './vault.js';

const program = new Command();

program
  .name('builder')
  .description('CLI to build FullerCloud OS images')
  .version('0.0.1')
  .option('-f, --pubkeyfile <string>', 'public key file path')
  .option('-c, --config <string>', 'config file path', 'fullercloudos.yml')
  .action(async (options) => {
    console.log(`🔎 Reading confic from ${options.conifg}...`);
    const configFileContents = fs.readFileSync(options.config, 'utf8')
    const config = parse(configFileContents);

    console.log(`🔎 Reading public key from ${options.pubkeyfile}...`);
    const publickey = fs.readFileSync(options.pubkeyfile, 'utf8').trim();

    const outputDir = path.join(process.cwd(), 'build');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const machines = config['fullercloud-os'].machines

    console.log(`\n🔧 Building images for ${machines.length} machines...`);
    for (const machine of machines) {
      const hostname = machine.hostname;

      console.log(`\n🔧 Building image for ${hostname}...`);
      await buildImage(hostname, publickey, outputDir);

      console.log(`🥧 Completed image for ${hostname}! `);
    }

    console.log("\n🥧 Done!");
  })

program.parse();

async function buildImage(hostname, publickey, outputDir) {
  const fullerCloudVault = new OnePasswordVault('FullerCloud');

  const deployPath = path.join(process.cwd(), 'deploy');
  const outputPath = path.join(outputDir, `./${hostname}-image-package`);

  var itemId = null;
  try {
    console.log(`Looking for existing vault item for ${hostname}...`);
    const item = await fullerCloudVault.findItemByTitle(hostname);

    if (item === null) {
      console.log(`Not found. Creating "${hostname}" vault item...`);
      const createdItem = await fullerCloudVault.createItemWithTitle(hostname, "fc-admin")
      itemId = createdItem.id
    } else {
      console.log(`Found. Rotating password for existing "${hostname}" vault item...`);
      await fullerCloudVault.rotateItem(item.id)
      itemId = item.id
    }
  } catch (error) {
    console.error(`Unable to generate new password for ${hostname}. Aborting.`);
    console.error(error);
    program.error(error);
  }

  const configFilePath = path.join(process.cwd(), `config`);
  try {
    console.log(`Reading password for existing "${hostname}" vault item...`);
    const password = await fullerCloudVault.readItem(itemId);

    console.log(`Generating config file for "${hostname}"...`);
    const configFileContents = await generatePiGenConfigFile(hostname, password, publickey);
    fs.writeFileSync(configFilePath, configFileContents);
  } catch (error) {
    console.error(`Unable to generate config file for ${hostname}. Aborting.`);
    program.error(error);
  }

  console.log(`Waiting 5 seconds before building image for ${hostname}...`);
  await new Promise((resolve) => setTimeout(resolve, 5000));

  let isSuccess = false;
  try {
    console.log("Building image with pi-gen...")
    await buildImageUsingConfigFile();
    isSuccess = true
    console.log(`Moving deploy folder to ${outputPath}...`)
    fs.renameSync(deployPath, outputPath)
  } catch (error) {
    console.error(error);
  } finally {
    console.log(`Deleting config file for "${hostname}"...`);
    await fs.writeFileSync(configFilePath, '');
    await fs.unlinkSync(configFilePath);
  }

  if (!isSuccess) {
    program.error(`Unable to correctly build image for ${hostname}. Aborting.`);
  }
}