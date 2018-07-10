class ExampleEvent extends EthereumEvent {
  get exampleParam(): string {
    return this.params[0].value.toString();
  }
}

class ExampleContract extends SmartContract {
  static bind(address: Address, blockHash: H256): ExampleContract {
    return new ExampleContract("ExampleContract", address, blockHash);
  }
}
