export class ExpectedMessages {
  static readonly passLimit: string = "Reactive flush exceeded 100 passes; an effect is probably writing a signal it depends on.";

  private constructor() { }
}
