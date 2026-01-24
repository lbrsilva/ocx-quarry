import { buildRegistry } from "ocx"

const result = await buildRegistry({
	source: ".",
	out: "dist",
})

console.log(`✓ Built ${result.componentsCount} components`)
