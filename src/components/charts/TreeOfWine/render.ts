import * as d3 from 'd3';
import { MutableRefObject } from 'react';
import { SetterOrUpdater } from 'recoil';
import { color, getAllChildren, getCountryAtTreeOfWine } from '../../../utils/chartUtils';
import { toggleSelection } from '../../../utils/dataUtils';
import { Tree, WineData, isChildrenTree } from '../../../utils/makeTree';
import { mainChartTransform } from './constant';

export function render(
  svgRef: MutableRefObject<SVGSVGElement>,
  nodeData: d3.HierarchyNode<Tree | WineData>[],
  linkData: d3.HierarchyLink<Tree | WineData>[],
  onMouseOver: (e: MouseEvent, d: WineData) => void,
  onMouseOut: () => void
) {
  const linkRadial = d3
    .linkRadial<d3.HierarchyLink<Tree | WineData>, d3.HierarchyNode<Tree | WineData>>()
    .angle((d) => d.x!)
    .radius((d) => d.y!);
  const r = 4;
  const svg = d3.select(svgRef.current);
  const g = svg.select('g.mouse-up');
  const linkGroup = g.select('g.link-group');
  const nodeGroup = g.select('g.node-group');

  linkGroup.selectAll('path').data(linkData).join('path').attr('d', linkRadial);

  const node = nodeGroup
    .selectAll('g')
    .data(nodeData)
    .join('g')
    .attr('transform', (d) => `rotate(${(d.x! * 180) / Math.PI - 90}) translate(${d.y},0)`)
    .on('mousemove', (e, d) => {
      if ('Country' in d.data) onMouseOver(e, d.data);
    })
    .on('mouseout', (_e, d) => {
      if ('Country' in d.data) onMouseOut();
    });

  node
    .append('circle')
    .attr('cursor', 'pointer')
    .attr('fill', (d) => (d.depth === 0 ? '#555' : color(getCountryAtTreeOfWine(d))))
    .attr('r', r);

  node
    .append('text')
    .attr('class', 'text')
    .attr('dy', '0.31em')
    .attr('x', (d) => (d.x! < Math.PI === !d.children ? 6 : -6))
    .attr('text-anchor', (d) => (d.x! < Math.PI === !d.children ? 'start' : 'end'))
    .attr('transform', (d) => (d.x! >= Math.PI ? 'rotate(180)' : null))
    .text((d) => {
      if (isChildrenTree(d.data)) {
        return d.data.name;
      } else {
        return d.data.Designation;
      }
    })
    .filter((d) => isChildrenTree(d.data))
    .clone(true)
    .lower()
    .attr('class', 'text-border')
    .attr('stroke', 'white');
}

export function setLayout(svgRef: MutableRefObject<SVGSVGElement>, size: number, fontSize: number) {
  const halfSize = size / 2;
  const svg = d3.select(svgRef.current);

  svg
    .attr('width', size + 150)
    .attr('height', size)
    .style('position', 'absolute')
    .style('box-sizing', 'border-box')
    .style('font', `${fontSize}px sans-serif`);
  // set layout and interaction
  // TODO: key, join 기능 활용해서 remove 교체하기
  d3.select(svgRef.current).selectAll('*').remove();
  /** 회전에 사용될 두 g
   * @var g.mouse_move mousemove 이벤트때 회전시킬 g
   * @var g.mouse_up mouseup 이벤트때 회전량을 증분 및 360도로 정규화 하면서 회전시킬 g
   *
   * 두 회전은 따로 작동함
   ** move일땐 g.mouse-move만 단독으로 증분 없이 회전시킴
   ** up일땐 g.mouse-up만 단독으로 증분 및 정규화하며 회전시킴
   *
   * move도 up처럼 증분하며 회전시키면 비정상적으로 빠르게 회전하기 때문에 이런 방식으로 구현함
   * 한 g 대신 svg를 회전시키면 svg의 width, height를 똑같이 맞춰야 하는 불편함이 있음
   */
  const outerG = svg.append('g').attr('class', 'mouse-move').attr('transform', mainChartTransform);
  const g = outerG
    .append('g')
    .attr('class', 'mouse-up')
    .attr('transform', `translate(${halfSize}, ${halfSize})`);
  g.append('g') // link
    .attr('class', 'link-group')
    .attr('fill', 'none')
    .attr('stroke', '#555')
    .attr('stroke-opacity', 0.4)
    .attr('stroke-width', 1.5);

  g.append('g') // node
    .attr('class', 'node-group')
    .attr('stroke-linejoin', 'round')
    .attr('stroke-width', 3);
}

export function setInteraction(
  svgRef: MutableRefObject<SVGSVGElement>,
  selection: Set<WineData>,
  setSelection: SetterOrUpdater<Set<WineData>>
) {
  const nodes = d3.select(svgRef.current).select('g.node-group');
  const time = 2000;
  /** 선택 리스트 강조 갱신 */
  nodes.selectAll<SVGTextElement, d3.HierarchyNode<WineData>>('text.text')
    .attr('font-weight', null)
    .filter(node => selection.has(node.data))
    .attr('font-weight', 'bold')

  /** event handler 갱신 */
  nodes
    .selectAll<SVGCircleElement, d3.HierarchyNode<WineData | Tree>>('circle')
    .on('mousedown', function ({ target }: MouseEvent, d) {
      const circle = d3.select(this);
      const text = d3
        .select((target as SVGCircleElement).parentElement)
        .select<SVGTextElement>('text.text');
      const fontWeight = text.attr('font-weight');
      const newSelection = new Set(getAllChildren(d));

      // leaf node일 때
      if (!d.children) {
        toggleSelection(selection, newSelection, setSelection);
        text.attr('font-weight', fontWeight ? null : 'bold');
        return;
      }

      // internal node일 때
      const timeout = setTimeout(() => {
        toggleSelection(selection, newSelection, setSelection);
        // delay 효과 제거
        circle
          .interrupt()
          .attr('stroke', null)
          .attr('stroke-width', null)
          .attr('stroke-dasharray', null);
      }, time / 2 - 450);

      // delay 효과 애니메이션
      circle
        .attr('stroke', 'red')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '0 100')
        .transition()
        .duration(time)
        .attr('stroke-dasharray', '100 0')
        .ease(d3.easeLinear)
        .end()
        .catch(() => {
          clearTimeout(timeout);
        });
    })
    .on('mouseup', function () {
      const circle = d3.select(this);
      circle
        .interrupt()
        .attr('stroke', null)
        .attr('stroke-width', null)
        .attr('stroke-dasharray', null);
    });
}
