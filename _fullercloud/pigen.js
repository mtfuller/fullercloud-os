import path from 'path';
import util from 'util';
import { exec as childProcessExec, spawn } from 'child_process'
const exec = util.promisify(childProcessExec);

export async function generatePiGenConfigFile(hostname, password, publickey) {
    return `IMG_NAME='fullercloud-rpi-os'
arm_64bit=1
LOCALE_DEFAULT='en_US.UTF-8'
KEYBOARD_KEYMAP='us'
KEYBOARD_LAYOUT='English (US)'
TIMEZONE_DEFAULT='America/New_York'
WPA_COUNTRY='US'
FIRST_USER_NAME='fc-admin'
DISABLE_FIRST_BOOT_USER_RENAME='1'
ENABLE_SSH='1'
PUBKEY_ONLY_SSH='1'
TARGET_HOSTNAME='${hostname}'
FIRST_USER_PASS='${password}'
PUBKEY_SSH_FIRST_USER='${publickey}'
`
}

export async function cleanUpPiGen() {
    return exec(`docker rm -v -f pigen_work`);
}

export async function buildImageUsingConfigFile() {
    try {
        await cleanUpPiGen();
    } catch (error) {
        console.warn(`unable to clean up pigen container: ${error}`)
    }

    const buildDockerPath = path.join(process.cwd(), 'build-docker.sh');
    const cmd = `${buildDockerPath}`;

    return new Promise((resolve, reject) => {

        const process = spawn(`${buildDockerPath}`)

        process.stdout.on('data', (data) => {
            console.log(`PI GEN: ${data}`);
        })

        process.stderr.on('data', (data) => {
            console.log(`PI GEN: (ERROR) ${data}`);
        })

        process.on('error', (error) => {
            reject(error);
        })

        process.on('exit', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`build-docker.sh failed with exit code ${code}`));
            }
        })
        
    });
}