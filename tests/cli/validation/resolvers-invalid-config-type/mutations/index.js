module.exports = {
  resolvers: {
    Mutation: {
      createGravatar: function () { },
      updateGravatarName: function () { },
      updateGravatarImage: function () { },
    },
  },
  config: {
    prop1: function (value) { },
    prop2: {
      prop3: 5
    }
  }
}
