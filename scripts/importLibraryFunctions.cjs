const fs = require('fs')
const path = require('path')
const { globSync } = require('fast-glob')
const parser = require('vue-eslint-parser')

// Define the path to your Vue project's source directory
const srcDir = path.join(__dirname, '../src')

// Helper function to create a regex for checking import statements
function createImportCheckRegex(moduleName, importNames) {
  const importNamesPattern = importNames.map(name => `\\b${name}\\b`).join('|')
  // Matches both single and double quotes, optional semicolon at the end
  return new RegExp(`import\\s+\\{[^}]*(${importNamesPattern})[^}]*\\}\\s+from\\s+['"]${moduleName}['"];?`, 'm')
}

function createFindImportRegex(moduleName) {
  // Matches both single and double quotes, optional semicolon at the end
  return new RegExp(`import\\s+\\{[^}]*\\}\\s+from\\s+['"]${moduleName}['"];?\\s*`, 'g')
}

// Function to check if specific Vue composition API functions, useI18n, useRouter, useRoute, and useVModels are used in the script setup
function detectNeededImports(content) {
  const ast = parser.parse(content, {
    sourceType: 'module',
    ecmaVersion: 2022,
    // Specify that we're parsing a Vue file
    // filePath: 'component.vue',
  })

  const neededImports = {
    vue: new Set(),
    vueI18n: false,
    pinia: false,
    vueRouter: false,
    vueUseCore: new Set(),
  }

  // Traverse the AST to find usage of Vue composition API functions, useI18n, useRouter, useRoute, and useVModels
  parser.AST.traverseNodes(ast, {
    enterNode(node) {
      if (node.type === 'Identifier') {
        switch (node.name) {
        case 'ref':
        case 'computed':
        case 'watch':
        case 'provide':
        case 'onMounted':
        case 'onUnmounted':
        case 'toRaw':
        case 'useAttrs':
        case 'watchEffect':
        case 'resolveComponent':
        case 'defineComponent':
        case 'defineAsyncComponent':
        case 'unref':
        case 'useSlots':
        case 'Transition':
        case 'getCurrentInstance':
        case 'onBeforeMount':
        case 'shallowRef':
        case 'markRaw':
        case 'toRef':
        case 'h':
        case 'nextTick':
        case 'inject':
          neededImports.vue.add(node.name)
          break
        case 'useI18n':
          neededImports.vueI18n = true
          break
        case 'useRouter':
        case 'useRoute':
          neededImports.vueRouter = true
          break
        case 'useVModels':
        case 'useStorage':
        case 'useToggle':
        case 'useWindowScroll':
        case 'useRefHistory':
        case 'useCycleList':
        case 'until':
        case 'useElementHover':
        case 'useIntersectionObserver':
        case 'useEventListener':
        case 'unrefElement':
        case 'useClipboard':
        case 'usePreferredDark':
        case 'useWindowSize':
        case 'useMutationObserver':
        case 'syncRef':
        case 'useMagicKeys':
        case 'breakpointsVuetify':
          neededImports.vueUseCore.add(node.name)
          break
        case 'defineStore':
          neededImports.pinia = true
          break
        }
      }
    },
    leaveNode() {
    },
  })

  return neededImports
}

function removeExistingImports(content, moduleNames) {
  moduleNames.forEach(moduleName => {
    const regex = createFindImportRegex(moduleName)
    content = content.replace(regex, '') // Remove the import statement
  })
  return content
}

// Function to construct and insert missing import statements into Vue files
function insertMissingImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  const isVueFile = filePath.endsWith('.vue')

  console.log(`Starting ${filePath}`)
  const neededImports = detectNeededImports(content)
  content = removeExistingImports(content, ['vue', 'vue-i18n', 'vue-router', '@vueuse/core', 'pinia'])

  const importStatements = []
  if (neededImports.vue.size > 0) {
    const vueImports = Array.from(neededImports.vue).join(", ")
    importStatements.push(`import { ${vueImports} } from 'vue'\n`)
  }

  if (neededImports.vueI18n) {
    importStatements.push("import { useI18n } from 'vue-i18n'\n")
  }

  if (neededImports.vueRouter) {
    importStatements.push("import { useRouter, useRoute } from 'vue-router'\n")
  }

  if (neededImports.vueUseCore.size > 0) {
    const vueUseCoreImports = Array.from(neededImports.vueUseCore).join(", ")
    importStatements.push(`import { ${vueUseCoreImports} } from '@vueuse/core';\n`)
  }

  if (neededImports.pinia) {
    importStatements.push("import { defineStore } from 'pinia'\n")
  }

  if (importStatements.length > 0) {
    if (isVueFile) {
      // Insert the import statements at the beginning of the script setup
      const scriptSetupRegex = /<script[^>]*\bsetup\b[^>]*>/
      const scriptTagMatch = content.match(scriptSetupRegex)
      const scriptTag = scriptTagMatch ? scriptTagMatch[0] : '<script>'

      const updatedContent = content.replace(scriptTag, `${scriptTag}\n${importStatements.join('')}`)
      // Write the updated content back to the file
      fs.writeFileSync(filePath, updatedContent, 'utf-8')
    } else {
      const updatedContent = importStatements.join('') + '\n' + content
      fs.writeFileSync(filePath, updatedContent, 'utf-8')
    }
    console.log(`Updated ${filePath}`)
  }
}

const files = globSync(`${srcDir}/**/*.{vue,js}`, {ignore: [`${srcDir}/@core/libs/*/**`]})
files.forEach(insertMissingImports)