import { createRoot } from 'react-dom/client';
import React from 'react';
import ZoomBar from './zoombar/zoomBar';

export default function () {

    // Setup ZoomBar
    setupComponent({
        id: "zoom-bar",
        pos: {
            left: "10vw",
            top: "1vh"
        },
        component: <ZoomBar />
    })

}



function setupComponent({ id, pos, component }: {
    id: string,
    pos: { left?: string, right?: string, top?: string, bottom?: string },
    component: React.ReactNode
}) {
    const div = document.createElement('div') as HTMLDivElement;
    div.classList.add('react-container')
    div.id = id;
    div.style.position = 'absolute';
    div.style.zIndex = '2';
    div.style.width = 'auto';
    div.style.height = 'auto';

    pos.left && (div.style.left = pos.left);
    pos.right && (div.style.right = pos.right);
    pos.top && (div.style.top = pos.top);
    pos.bottom && (div.style.bottom = pos.bottom);

    document.body.appendChild(div);

    createRoot(div).render(component)
}