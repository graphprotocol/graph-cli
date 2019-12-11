const immutable = require('immutable')

const List = immutable.List

module.exports.validateMutationResolvers = (filepath, { resolveFile }) => {
    const resolversModule = require(resolveFile(filepath)).default;

    // Validate default exports an object with properties resolvers and config
    if (!resolversModule.hasOwnProperty('resolvers') || !resolversModule.hasOwnProperty('config'))
        return immutable.fromJS([
            {
                path: ["Resolvers package"],
                message: `Resolvers's default exports must be an object with properties resolvers and config`,
            },
        ])

    // Validate resolvers has property Mutations which includes all of the schema's mutations.
    if (!resolversModule.resolvers.hasOwnProperty("Mutations"))
        return immutable.fromJS([
            {
                path: ["Resolvers package"],
                message: `Resolvers's resolvers property must have property Mutations which includes all of the schema's mutations`,
            },
        ])

    //TODO: what about custom properties? they are objects at leaf level, not functions
    // Validate config's leaf properties are all functions
    // for (let leafProp of Object.keys(resolversModule.config)) {
    //     console.log(resolversModule.config[leafProp])
    //     if (typeof resolversModule.config[leafProp] !== "function")
    //         return immutable.fromJS([
    //             {
    //                 path: ["Resolvers package"],
    //                 message: `Resolvers's config property can only have function properties`,
    //             },
    //         ])
    // }

    return List()
}
