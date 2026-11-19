package com.bibliotrack.ica.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class NavegacionController {
    @GetMapping("/admin.html")
    public String admin() {
        return "redirect:/frontend/admin/admin.html";
    }

    @GetMapping("/Ventas.html")
    public String Ventas() {
        return "redirect:/frontend/admin/ventas.html";
    }

    @GetMapping("/ventas.html")
    public String ventas() {
        return "redirect:/frontend/admin/ventas.html";
    }

    @GetMapping("/productos.html")
    public String productos() {
        return "redirect:/frontend/usuario/productos.html";
    }

    @GetMapping("/contacto.html")
    public String contacto() {
        return "redirect:/frontend/usuario/contacto.html";
    }

    @GetMapping("/carrito.html")
    public String carrito() {
        return "redirect:/frontend/usuario/carrito.html";
    }

    @GetMapping("/login.html")
    public String login() {
        return "redirect:/frontend/auth/login.html";
    }

    @GetMapping("/register.html")
    public String register() {
        return "redirect:/frontend/auth/register.html";
    }
}
