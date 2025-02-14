import {
	onManageActiveEffect,
	prepareActiveEffectCategories,
} from "../effects.mjs";

/**
 * @extends {ItemSheet}
 */
export default class FalloutItemSheet extends ItemSheet {

	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			classes: ["fallout", "sheet", "item"],
			width: 520,
			height: 520,
			tabs: [{
				navSelector: ".sheet-tabs",
				contentSelector: ".sheet-body",
				initial: "attributes",
			}],
		});
	}

	/** @override */
	get template() {
		const path = "systems/fallout/templates/item";
		return `${path}/item-${this.item.type}-sheet.hbs`;
	}

	/** @inheritdoc */
	get title() {
		const type = game.i18n.localize(`TYPES.Item.${this.item.type}`);
		return `[${type}] ${this.item.name}`;
	}

	/* -------------------------------------------- */

	/** @override */
	async getData(options) {
		// Retrieve base data structure.
		const context = await super.getData(options);
		const item = context.item;
		const source = item.toObject();

		foundry.utils.mergeObject(context, {
			descriptionHTML: await TextEditor.enrichHTML(item.system.description, {
				secrets: item.isOwner,
				async: true,
			}),
			effects: prepareActiveEffectCategories(item.effects),
			FALLOUT: CONFIG.FALLOUT,
			flags: item.flags,
			isEmbedded: item.isEmbedded,
			source: source.system,
			system: item.system,
			type: item.type,
			useKgs: game.settings.get("fallout", "carryUnit") === "kgs",
		});

		// Enrich Mods Text
		if (item.system.mods) {
			foundry.utils.mergeObject(context, {
				modsListHTML: await TextEditor.enrichHTML(item.system.mods.list, {
					secrets: item.isOwner,
					async: true,
				}),
			});
		}

		// Enrich Effect Text
		if (item.system.effect) {
			foundry.utils.mergeObject(context, {
				effectHTML: await TextEditor.enrichHTML(item.system.effect, {
					secrets: item.isOwner,
					async: true,
				}),
			});
		}

		if (item.type === "weapon") {
			context.damageTypes = [];
			for (const key in CONFIG.FALLOUT.DAMAGE_TYPES) {
				context.damageTypes.push({
					active: item.system?.damage?.damageType[key] ?? false,
					key,
					label: CONFIG.FALLOUT.DAMAGE_TYPES[key],
				});
			}

			const weaponQualities = [];
			for (const key in CONFIG.FALLOUT.WEAPON_QUALITIES) {
				weaponQualities.push({
					active: item.system?.damage?.weaponQuality[key].value ?? false,
					hasRank: CONFIG.FALLOUT.WEAPON_QUALITY_HAS_RANK[key],
					rank: item.system?.damage?.weaponQuality[key].rank,
					key,
					label: CONFIG.FALLOUT.WEAPON_QUALITIES[key],
				});
			}

			context.weaponQualities = weaponQualities.sort(
				(a, b) => a.label.localeCompare(b.label)
			);

			const damageEffects = [];
			for (const key in CONFIG.FALLOUT.DAMAGE_EFFECTS) {
				damageEffects.push({
					active: item.system?.damage?.damageEffect[key].value ?? false,
					hasRank: CONFIG.FALLOUT.DAMAGE_EFFECT_HAS_RANK[key],
					rank: item.system?.damage?.damageEffect[key].rank,
					key,
					label: CONFIG.FALLOUT.DAMAGE_EFFECTS[key],
				});
			}

			context.damageEffects = damageEffects.sort(
				(a, b) => a.label.localeCompare(b.label)
			);
		}

		if (item.type === "object_or_structure") {
			// Setup materials
			context.materials = [];
			for (const material of ["common", "uncommon", "rare"]) {
				context.materials.push({
					label: game.i18n.localize(`FALLOUT.actor.inventory.materials.${material}`),
					key: `system.materials.${material}`,
					value: source.system.materials[material] ?? 0,
				});
			}

			const __getDescendants = function(output, actor, item) {
				const descendants = actor.items.filter(
					i => i.system.parentItem === item._id
				);

				for (const nextDescendant of descendants) {
					output.push(nextDescendant);
					__getDescendants(output, actor, nextDescendant);
				}
			};

			if (context.isEmbedded) {
				const descendants = [];
				__getDescendants(descendants, this.item.actor, item);

				let possibleParents =
					await this.item.actor.items.filter(i =>
						["structure", "room", "store"].includes(i.system.itemType)
						&& item._id !== i._id
						&& (!descendants.find(d => d._id === i._id))
					) ?? [];

				if (this.item.system.itemType === "structure") possibleParents = [];

				if (this.item.system.itemType === "room") {
					possibleParents = possibleParents.filter(
						i => i.system.itemType === "structure"
					);
				}

				const parentChoices = [];
				for (const possibleParent of possibleParents) {
					parentChoices.push({
						id: possibleParent._id,
						name: possibleParent.name,
					});
				}

				context.parentChoices = parentChoices.sort(
					(a, b) => a.name.localeCompare(b.name)
				);
			}
		}

		return context;
	}

	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		// Everything below here is only needed if the sheet is editable
		if (!this.isEditable) return;

		// Effects.
		html.find(".effect-control").click(ev => {
			if (this.item.isOwned) {
				return ui.notifications.warn("Managing Active Effects within an Owned Item is not currently supported and will be added in a subsequent update.");
			}
			onManageActiveEffect(ev, this.item);
		});

		// Send To Chat
		html.find(".chaty").click(ev => {
			this.item.sendToChat();
		});

		// DON't LET NUMBER FIELDS EMPTY
		const numInputs = document.querySelectorAll("input[type=number]");
		numInputs.forEach(function(input) {
			input.addEventListener("change", function(e) {
				if (e.target.value === "") {
					e.target.value = 0;
				}
			});
		});
	}
}
