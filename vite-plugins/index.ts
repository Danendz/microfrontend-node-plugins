import path from "path";
import fs from "fs";

const readDirs = (includeDirs: string[], cb: (...args: any[]) => any) => {
    const directoryPath = path.resolve(__dirname, '..', 'src');

    // Function to recursively read directories
    function readDirectories(dir: string) {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                readDirectories(fullPath);
            } else {
                cb(fullPath)
            }
        }
    }

    for (const dir of includeDirs) {
        readDirectories(path.resolve(directoryPath, dir));
    }
}


export const getExposesPaths = (dirs: string[]) => {
    const paths = new Map()

    readDirs(dirs, (path: string) => {
        path = path.slice(path.indexOf('src')).replace(/\\/g, '/').replace('src', './src')

        let pathWithoutExt = path.slice(0, path.lastIndexOf('.')).replace('src/', '')

        const isIndex = pathWithoutExt.lastIndexOf('index')
        if (isIndex !== -1) {
            pathWithoutExt = pathWithoutExt.slice(0, isIndex-1)
        }

        paths.set(pathWithoutExt, path)
    })

    const result = Object.fromEntries(paths)
    const pathToBuildData = path.resolve(__dirname, '..', 'build_data')

    if (!fs.existsSync(pathToBuildData)) {
        fs.mkdirSync(pathToBuildData)
    }

    fs.writeFileSync(path.resolve(pathToBuildData, 'exposed_modules.json'), JSON.stringify(result))

    return result
}
