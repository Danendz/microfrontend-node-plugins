# Useful scripts for micro-frontends

#### There's 3 scripts:
- ```createRemoteDeclarations.cjs``` - used to generate .d.ts declaration files and import them from other frontened applications
- ```importLibraryFunctions.cjs``` - used to import libraries functions, because auto imports doesn't really work with micro-frontend applications
- ```importRemoteComponents.cjs``` - used to import remote components based on generated exposed_modules.json file inside of other micro-frontend applications


### There's 1 vite "plugin":
- ```getExposesPaths``` - used to generate exposed modules object like:
```js
{
	'./components/Datepicker': './src/components/Datepicker.vue',
	...
}
```