import util from 'util';
import { exec as childProcessExec} from 'child_process'
const exec = util.promisify(childProcessExec);

export class OnePasswordVault {
    constructor(name) {
        this.vaultName = name;
    }

    async hasItemWithTitle(title) {
        const itemsWithTitle = await this.listItemsWithTitle(title);
    
        if (itemsWithTitle.length === 0) {
            return Promise.resolve(false);
        } else if (itemsWithTitle.length > 1) {
            return Promise.reject(new Error(`Found multiple 1Password items with title ${title}`));
        }
    
        return Promise.resolve(true);
    }

    async listItemsWithTitle(title) {
        const cmd = `op item list --vault ${this.vaultName} --format json`;

        const items = await this._executeCommand(cmd);
    
        const itemsWithTitle = items.filter(item => item.title === title);
    
        return Promise.resolve(itemsWithTitle);
    }

    async findItemByTitle(title) {
        const itemsWithTitle = await this.listItemsWithTitle(title);
    
        if (itemsWithTitle.length === 0) {
            return Promise.resolve(null);
        } else if (itemsWithTitle.length > 1) {
            return Promise.reject(new Error(`Found multiple 1Password items with title ${title}`));
        }
    
        return Promise.resolve(itemsWithTitle[0]);
    }

    async readItem(id) {
        const cmd = `op item get ${id} ` + 
            `--vault ${this.vaultName} ` + 
            `--format json`;

        const item = await this._executeCommand(cmd);

        const fieldsWithPassword = item.fields.filter(field => field.id === 'password');
        if (fieldsWithPassword.length !== 1) {
            return Promise.reject(new Error(`Unable to find password field in item ${title}`));
        }

        const password = fieldsWithPassword[0].value;

        return Promise.resolve(password);
    }
    
    async createItemWithTitle(title, username) {
        const cmd = `op item create ` + 
            `--category login ` + 
            `--title "${title}" ` + 
            `--vault ${this.vaultName} ` + 
            `--generate-password='letters,digits,symbols,16' ` +
            `--format=json ` + 
            `- username=${username}`

        const item = await this._executeCommand(cmd);
    
        return Promise.resolve(item.id);
    }
    
    async rotateItem(id) {
        const cmd = `op item edit ${id} ` +
            `--vault ${this.vaultName} ` + 
            `--generate-password='letters,digits,symbols,16' ` +
            `--format=json`

        const item = await this._executeCommand(cmd);

        return Promise.resolve(item.id);
    }

    async _executeCommand(cmd) {
        const result = await exec(cmd);
        if (result.stderr) {
            console.error(`Error executing cmd:` + cmd)
            throw new Error(result.stderr);
        }

        return JSON.parse(result.stdout);
    }

}
