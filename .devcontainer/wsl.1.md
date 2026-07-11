```json
// please ignore & collapse this section on future visits
1. Confirm target architecture
2. Windows 11 + WSL2 + WSLg.
3. Docker engine reachable from WSL (Docker Desktop integration or native Docker in WSL).
4. VS Code Dev Containers attached from WSL context.
5. Use Plan9/9p only for Windows file sharing, not GUI sockets.
6. Validate host prerequisites
7. NVIDIA Windows driver is WSL-capable (recent Studio/Game Ready with CUDA-on-WSL support).
8. In WSL, GPU is visible (nvidia-smi works).
9. Docker GPU runtime works (docker run with --gpus all can see GPU).
10. WSLg is active (GUI Linux app opens in Windows).
11. Define container graphics model
12. Mount WSLg runtime sockets into container so X11/Wayland clients can draw to Windows.
13. Pass environment values for display/audio/runtime from WSL into container.
14. Enable GPU in container with gpus all.
15. Keep workspace on Linux filesystem for performance; use Plan9 mount only when you need Windows-side file exchange.
16. Prepare devcontainer settings
17. Add run arguments for GPU and larger shared memory.
18. Add bind mounts for WSLg runtime and X11 socket directories.
19. Forward environment values for DISPLAY, WAYLAND_DISPLAY, XDG_RUNTIME_DIR, PULSE_SERVER.
20. Install userland graphics packages in the container (x11-utils, mesa tools, herbstluftwm, Xephyr, optional xterm).
21. Launch herbstluftwm as nested WM
22. Start Xephyr display inside the container (example display :1 with fixed resolution).
23. Start herbstluftwm on that nested display.
24. Start one test client inside the same display.
25. You should see one Windows-hosted window containing the nested desktop managed by herbstluftwm.
26. Apply and verify theme color
27. Put the #FEEF69 color in the herbstluftwm startup/theme commands.
28. Verify interactability by opening multiple test windows in the nested display and focusing/moving them.
29. Confirm the color is visible in frame/border/background elements you configured.
30. Native Windows communication over Plan9
31. Keep source-of-truth configs in WSL Linux filesystem.
32. Use Plan9-mounted Windows paths only for exchange with native Windows tools.
33. Avoid placing X11/Wayland sockets on Plan9 mounts; keep them on WSL Linux runtime paths.
34. Hardening and usability
35. Add a single startup script in container to launch Xephyr + herbstluftwm consistently.
36. Add health checks: GPU availability, display socket presence, and WM process alive.
37. Add fallback mode: software rendering if GPU is unavailable.
```