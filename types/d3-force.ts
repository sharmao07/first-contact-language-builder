declare module "d3-force" {
  export interface SimulationNodeDatum {
    index?: number;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  }

  export interface SimulationLinkDatum<Node extends SimulationNodeDatum> {
    source: Node | string | number;
    target: Node | string | number;
    index?: number;
  }

  export interface Simulation<Node extends SimulationNodeDatum> {
    force(name: string, force: unknown): this;
    nodes(): Node[];
    stop(): this;
    tick(iterations?: number): this;
  }

  export interface ForceLink<Node extends SimulationNodeDatum> {
    id(accessor: (node: Node) => string): this;
    distance(distance: number): this;
  }

  export function forceSimulation<Node extends SimulationNodeDatum>(nodes?: Node[]): Simulation<Node>;
  export function forceLink<Node extends SimulationNodeDatum, Link extends SimulationLinkDatum<Node>>(links?: Link[]): ForceLink<Node>;
  export function forceManyBody(): { strength(strength: number): unknown };
  export function forceCenter(x?: number, y?: number): unknown;
  export function forceCollide(radius?: number): unknown;
}
